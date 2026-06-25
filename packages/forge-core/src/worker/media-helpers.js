/**
 * Media Worker Helpers -- standalone TTS and STT execution logic
 * extracted from AudioWorker to keep media.js under the 500-line limit.
 *
 * These functions receive the parent worker instance so they can reuse
 * ensureOutputDir, generateFilename, validateOutputFile, formatResult,
 * and formatError without duplicating that logic.
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  synthesizeSpeech,
  transcribeAudio,
} from '../multimodal-client/index.js';

/**
 * Text-to-Speech execution.
 * @param {import('./media.js').MediaWorker} worker -- parent worker instance
 * @param {object} task -- task descriptor
 * @param {string} projectRoot -- project root directory
 * @returns {Promise<object>}
 */
export async function executeTTS(worker, task, projectRoot) {
  const text = task.text || task.prompt || task.description || task.name;
  if (!text) {
    return { success: false, error: 'AudioWorker TTS: no text provided' };
  }

  const voice = task.voice || 'alloy';
  const model = task.model || 'tts-1';
  const format = task.format || task.audioFormat || 'mp3';
  const speed = task.speed;
  const provider = task.provider;

  const outputDir = await worker.ensureOutputDir(projectRoot);
  const filename = task.outputFile || worker.generateFilename('speech', format, task.id);
  const outputPath = join(outputDir, filename);

  console.log(`[forge:media] Synthesizing speech: "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`);
  console.log(`[forge:media]   voice=${voice}, model=${model}, format=${format}`);

  try {
    const result = await synthesizeSpeech(text, {
      model,
      voice,
      format,
      speed,
      provider,
      outputPath,
    });

    const valid = await worker.validateOutputFile(outputPath);
    console.log(`[forge:media] Speech synthesized: ${outputPath} (${result.sizeBytes || 0} bytes)`);

    return worker.formatResult(
      {
        audioPath: outputPath,
        format,
        model: result.model,
        provider: result.provider,
        sizeBytes: result.sizeBytes,
      },
      {
        taskId: task.id,
        status: 'completed',
        type: 'audio',
        filesModified: valid ? [{ path: outputPath, action: 'create' }] : [],
      }
    );
  } catch (err) {
    console.error(`[forge:media] TTS failed: ${err.message}`);
    return worker.formatError(err, task, 'audio');
  }
}

/**
 * Speech-to-Text execution.
 * @param {import('./media.js').MediaWorker} worker -- parent worker instance
 * @param {object} task -- task descriptor
 * @param {string} projectRoot -- project root directory
 * @returns {Promise<object>}
 */
export async function executeSTT(worker, task, projectRoot) {
  const audioPath = task.audioFile || task.inputFile || task.audio;
  if (!audioPath) {
    return { success: false, error: 'AudioWorker STT: no audio file path provided' };
  }

  const model = task.model || 'whisper-1';
  const language = task.language;
  const prompt = task.transcriptionPrompt;
  const provider = task.provider;

  console.log(`[forge:media] Transcribing audio: ${audioPath}`);
  console.log(`[forge:media]   model=${model}, language=${language || 'auto'}`);

  try {
    // Resolve relative audio paths against project root
    const resolvedPath = audioPath.startsWith('/') || audioPath.match(/^[A-Z]:\\/i)
      ? audioPath
      : join(projectRoot, audioPath);

    const result = await transcribeAudio(resolvedPath, {
      model,
      language,
      prompt,
      provider,
    });

    console.log(`[forge:media] Transcription complete: ${result.text.length} chars` +
      (result.duration ? `, ${result.duration.toFixed(1)}s audio` : ''));

    // Optionally save transcription to file
    if (task.outputFile) {
      const outputDir = await worker.ensureOutputDir(projectRoot);
      const filename = task.outputFile.endsWith('.txt') ? task.outputFile : `${task.outputFile}.txt`;
      const outputPath = join(outputDir, filename);
      await writeFile(outputPath, result.text, 'utf-8');
      console.log(`[forge:media] Transcription saved: ${outputPath}`);

      return worker.formatResult(
        {
          text: result.text,
          language: result.language,
          duration: result.duration,
          model: result.model,
          provider: result.provider,
          outputPath,
        },
        {
          taskId: task.id,
          status: 'completed',
          type: 'transcription',
          filesModified: [{ path: outputPath, action: 'create' }],
        }
      );
    }

    return worker.formatResult(
      {
        text: result.text,
        language: result.language,
        duration: result.duration,
        model: result.model,
        provider: result.provider,
      },
      {
        taskId: task.id,
        status: 'completed',
        type: 'transcription',
      }
    );
  } catch (err) {
    console.error(`[forge:media] STT failed: ${err.message}`);
    return worker.formatError(err, task, 'transcription');
  }
}
