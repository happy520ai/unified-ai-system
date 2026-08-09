// Command prompt-enhancement previews the provider-free prompt enhancement route.
// It uses only Go's standard library and never sends a provider credential.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	defaultBaseURL = "http://127.0.0.1:3100"
	defaultInput   = "Help me plan a small API for my team"
	defaultProfile = "planning"
	defaultLanguage = "en"
	requestTimeout = 10 * time.Second
)

var supportedProfiles = map[string]bool{
	"auto": true, "general": true, "coding": true, "analysis": true,
	"writing": true, "research": true, "planning": true,
}

var supportedLanguages = map[string]bool{
	"auto": true, "zh-CN": true, "en": true,
}

type options struct {
	baseURL  string
	input    string
	profile  string
	language string
	help     bool
}

type healthResponse struct {
	Status string `json:"status"`
	Data   struct {
		Status             string `json:"status"`
		RealProviderEnabled *bool  `json:"realProviderEnabled"`
	} `json:"data"`
}

type enhancementResponse struct {
	Status string `json:"status"`
	Data   enhancementData `json:"data"`
}

type enhancementData struct {
	Original       string   `json:"original"`
	EnhancedPrompt string   `json:"enhancedPrompt"`
	Profile        string   `json:"profile"`
	Language       string   `json:"language"`
	Metadata       metadata `json:"metadata"`
}

type metadata struct {
	Engine             string `json:"engine"`
	ProviderCalled     bool   `json:"providerCalled"`
	CredentialRequired bool   `json:"credentialRequired"`
	Deterministic      bool   `json:"deterministic"`
}

func usage() string {
	return `Usage: go run docs/examples/prompt-enhancement.go [input] [options]

Options:
  --base-url <url>       Gateway URL (default: ` + defaultBaseURL + `)
  --profile <profile>    Enhancement profile (default: ` + defaultProfile + `)
  --language <language>  Output language (default: ` + defaultLanguage + `)
  --help                 Show this message
`
}

func parseArgs(args []string) (options, error) {
	result := options{
		baseURL:  defaultBaseURL,
		profile:  defaultProfile,
		language: defaultLanguage,
	}
	var inputParts []string

	for index := 0; index < len(args); index++ {
		arg := args[index]
		switch {
		case arg == "--help":
			result.help = true
		case arg == "--base-url", arg == "--profile", arg == "--language":
			if index+1 >= len(args) || strings.HasPrefix(args[index+1], "--") {
				return options{}, fmt.Errorf("%s requires a value", arg)
			}
			value := args[index+1]
			index++
			switch arg {
			case "--base-url":
				result.baseURL = value
			case "--profile":
				result.profile = value
			case "--language":
				result.language = value
			}
		case strings.HasPrefix(arg, "--base-url="):
			result.baseURL = strings.TrimPrefix(arg, "--base-url=")
		case strings.HasPrefix(arg, "--profile="):
			result.profile = strings.TrimPrefix(arg, "--profile=")
		case strings.HasPrefix(arg, "--language="):
			result.language = strings.TrimPrefix(arg, "--language=")
		case strings.HasPrefix(arg, "-"):
			return options{}, fmt.Errorf("unknown option: %s", arg)
		default:
			inputParts = append(inputParts, arg)
		}
	}

	result.input = strings.TrimSpace(strings.Join(inputParts, " "))
	if result.input == "" {
		result.input = defaultInput
	}
	if !supportedProfiles[result.profile] {
		return options{}, fmt.Errorf("unsupported profile: %s", result.profile)
	}
	if !supportedLanguages[result.language] {
		return options{}, fmt.Errorf("unsupported language: %s", result.language)
	}

	parsedURL, err := url.Parse(result.baseURL)
	if err != nil || parsedURL.Host == "" || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		return options{}, errors.New("gateway URL must use http or https")
	}
	result.baseURL = strings.TrimRight(result.baseURL, "/")
	return result, nil
}

func requestJSON(client *http.Client, method, endpoint string, payload interface{}, target interface{}) error {
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("encode request: %w", err)
		}
		body = strings.NewReader(string(encoded))
	}

	request, err := http.NewRequest(method, endpoint, body)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}

	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("%s could not be reached: %w", endpoint, err)
	}
	defer response.Body.Close()

	rawBody, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return fmt.Errorf("read %s response: %w", endpoint, err)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("%s returned HTTP %d: %s", endpoint, response.StatusCode, strings.TrimSpace(string(rawBody)))
	}
	if err := json.Unmarshal(rawBody, target); err != nil {
		return fmt.Errorf("%s returned invalid JSON: %w", endpoint, err)
	}
	return nil
}

func requireProviderFreeHealth(health healthResponse) error {
	if health.Status != "ok" || health.Data.Status != "ready" || health.Data.RealProviderEnabled == nil || *health.Data.RealProviderEnabled {
		return errors.New("refusing to continue: gateway is not ready in explicit provider-free mode")
	}
	return nil
}

func requireProviderFreeEnhancement(result enhancementResponse, input string) error {
	data := result.Data
	if result.Status != "ok" || data.Original != input || data.EnhancedPrompt == "" || !strings.Contains(data.EnhancedPrompt, input) {
		return errors.New("response did not preserve the original request")
	}
	if data.Metadata.Engine != "local-deterministic" || data.Metadata.ProviderCalled || data.Metadata.CredentialRequired || !data.Metadata.Deterministic {
		return errors.New("response did not prove local deterministic prompt enhancement")
	}
	return nil
}

func run() error {
	args, err := parseArgs(os.Args[1:])
	if err != nil {
		return err
	}
	if args.help {
		fmt.Print(usage())
		return nil
	}

	client := &http.Client{Timeout: requestTimeout}
	health := healthResponse{}
	if err := requestJSON(client, http.MethodGet, args.baseURL+"/health/check", nil, &health); err != nil {
		return err
	}
	if err := requireProviderFreeHealth(health); err != nil {
		return err
	}

	result := enhancementResponse{}
	if err := requestJSON(client, http.MethodPost, args.baseURL+"/prompts/enhance", map[string]string{
		"input": args.input, "profile": args.profile, "language": args.language,
	}, &result); err != nil {
		return err
	}
	if err := requireProviderFreeEnhancement(result, args.input); err != nil {
		return err
	}

	output := struct {
		Original       string   `json:"original"`
		EnhancedPrompt string   `json:"enhancedPrompt"`
		Profile        string   `json:"profile"`
		Language       string   `json:"language"`
		Metadata       metadata `json:"metadata"`
	}{
		Original: result.Data.Original, EnhancedPrompt: result.Data.EnhancedPrompt,
		Profile: result.Data.Profile, Language: result.Data.Language, Metadata: result.Data.Metadata,
	}
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	return encoder.Encode(output)
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "Prompt enhancement example failed: %s\n", err)
		os.Exit(1)
	}
}
