package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	methodologyVersion = "gateway-open-loop-soak-v2"
	maxCapturedOutput  = 16 * 1024
	maxResponseBytes   = 1024 * 1024
)

type config struct {
	repoRoot             string
	target               string
	output               string
	model                string
	duration             time.Duration
	rateRPS              float64
	maxOutstanding       int
	requestTimeout       time.Duration
	maxP95               time.Duration
	maxSchedulerLagP95   time.Duration
	minArrivalRatio      float64
	maxErrorRate         float64
	maxInFlight          int
	burstRequests        int
	interruptRequests    int
	faultProbes          bool
	managed              bool
	jsonOutput           bool
}

type managedGateway struct {
	cmd        *exec.Cmd
	wait       chan error
	baseURL    string
	stdout     *boundedBuffer
	stderr     *boundedBuffer
	health     healthResult
	cleanedUp  bool
}

type boundedBuffer struct {
	mu   sync.Mutex
	data []byte
}

func (b *boundedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.data = append(b.data, p...)
	if len(b.data) > maxCapturedOutput {
		b.data = append([]byte(nil), b.data[len(b.data)-maxCapturedOutput:]...)
	}
	return len(p), nil
}

func (b *boundedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return string(b.data)
}

type requestResult struct {
	status        int
	latencyMS     float64
	ok            bool
	protocolValid bool
	safetyValid   bool
	timedOut      bool
	errCode       string
}

type metricSummary struct {
	Samples int      `json:"samples"`
	Min     *float64 `json:"min"`
	Mean    *float64 `json:"mean"`
	P50     *float64 `json:"p50"`
	P95     *float64 `json:"p95"`
	P99     *float64 `json:"p99"`
	Max     *float64 `json:"max"`
}

type openLoopSummary struct {
	Scheduled             int               `json:"scheduled"`
	Started               int               `json:"started"`
	ClientDropped         int               `json:"clientDropped"`
	Completed             int               `json:"completed"`
	Succeeded             int               `json:"succeeded"`
	Failed                int               `json:"failed"`
	ProtocolValid         int               `json:"protocolValid"`
	SafetyValid           int               `json:"safetyValid"`
	Timeouts              int               `json:"timeouts"`
	TransportErrors       int               `json:"transportErrors"`
	MaxOutstandingObserved int              `json:"maxOutstandingObserved"`
	TargetRPS             float64           `json:"targetRps"`
	StartedRPS            float64           `json:"startedRps"`
	SuccessfulRPS         float64           `json:"successfulRps"`
	ArrivalRatio          float64           `json:"arrivalRatio"`
	ErrorRate             float64           `json:"errorRate"`
	ProtocolValidityRate  float64           `json:"protocolValidityRate"`
	WallDurationMS        float64           `json:"wallDurationMs"`
	LatencyMS             metricSummary     `json:"latencyMs"`
	SchedulerLagMS        metricSummary     `json:"schedulerLagMs"`
	StatusCodes           map[string]int    `json:"statusCodes"`
}

type backpressureSummary struct {
	Status             string         `json:"status"`
	Reason             string         `json:"reason,omitempty"`
	Attempted          int            `json:"attempted"`
	Accepted           int            `json:"accepted"`
	OverloadRejected   int            `json:"overloadRejected"`
	Unexpected         int            `json:"unexpected"`
	StatusCodes        map[string]int `json:"statusCodes"`
	RecoveryRequestOK  bool           `json:"recoveryRequestOk"`
	RecoveryHealthOK   bool           `json:"recoveryHealthOk"`
}

type interruptionSummary struct {
	Status             string `json:"status"`
	Reason             string `json:"reason,omitempty"`
	Attempted          int    `json:"attempted"`
	HeadersReceived    int    `json:"headersReceived"`
	FirstBytesRead     int    `json:"firstBytesRead"`
	ConnectionsClosed  int    `json:"connectionsClosed"`
	Unexpected         int    `json:"unexpected"`
	RecoveryRequestOK  bool   `json:"recoveryRequestOk"`
	RecoveryHealthOK   bool   `json:"recoveryHealthOk"`
}

type healthResult struct {
	OK                  bool   `json:"ok"`
	StatusCode          int    `json:"statusCode"`
	Status              string `json:"status"`
	ProviderMode        string `json:"providerMode"`
	RealProviderEnabled bool   `json:"realProviderEnabled"`
}

type checkResult struct {
	Code        string `json:"code"`
	Passed      bool   `json:"passed"`
	Expectation string `json:"expectation"`
	Actual      any    `json:"actual"`
}

type errorResult struct {
	Message string `json:"message"`
}

type report struct {
	SchemaVersion      int                 `json:"schemaVersion"`
	MethodologyVersion string              `json:"methodologyVersion"`
	Status             string              `json:"status"`
	GeneratedAt        string              `json:"generatedAt"`
	StartedAt          string              `json:"startedAt"`
	TotalDurationMS    float64             `json:"totalDurationMs"`
	Mode               string              `json:"mode"`
	Target             map[string]any      `json:"target"`
	Workload           map[string]any      `json:"workload"`
	Thresholds         map[string]any      `json:"thresholds"`
	Environment        map[string]any      `json:"environment"`
	Safety             map[string]any      `json:"safety"`
	OpenLoop           *openLoopSummary    `json:"openLoop"`
	Backpressure       backpressureSummary `json:"backpressure"`
	Interruption       interruptionSummary `json:"interruption"`
	Checks             []checkResult       `json:"checks"`
	IssueCodes         []string            `json:"issueCodes"`
	FatalError         *errorResult        `json:"fatalError"`
	ComparisonBoundary string              `json:"comparisonBoundary"`
}

func main() {
	cfg, showHelp, err := parseConfig(os.Args[1:])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	if showHelp {
		printHelp()
		return
	}

	result := run(cfg)
	if err := writeReport(cfg.output, result); err != nil {
		fmt.Fprintf(os.Stderr, "write report: %v\n", err)
		os.Exit(1)
	}
	if cfg.jsonOutput {
		encoded, _ := json.Marshal(result)
		fmt.Println(string(encoded))
	} else {
		printSummary(result, cfg.output)
	}
	if result.Status != "passed" {
		os.Exit(1)
	}
}

func run(cfg config) report {
	startedAt := time.Now().UTC()
	started := time.Now()
	var gateway *managedGateway
	var health healthResult
	var openLoop *openLoopSummary
	backpressure := skippedBackpressure("fault probes are disabled for this target")
	interruption := skippedInterruption("fault probes are disabled for this target")
	var fatal *errorResult
	endpoint := cfg.target
	cleanedUp := any(nil)

	if cfg.managed {
		var err error
		gateway, err = startManagedGateway(cfg)
		if err != nil {
			fatal = &errorResult{Message: err.Error()}
		} else {
			endpoint = gateway.baseURL + "/v1/chat/completions"
			health = gateway.health
		}
	}

	if fatal == nil {
		client := newHTTPClient(cfg)
		openLoop = runOpenLoop(client, endpoint, cfg)
		if cfg.faultProbes {
			backpressure = runBackpressure(client, endpoint, gatewayBaseURL(gateway, endpoint), cfg)
			interruption = runInterruption(client, endpoint, gatewayBaseURL(gateway, endpoint), cfg)
		}
		client.CloseIdleConnections()
	}

	if gateway != nil {
		gateway.cleanedUp = stopManagedGateway(gateway)
		cleanedUp = gateway.cleanedUp
	}

	checks := buildChecks(cfg, health, openLoop, backpressure, interruption, fatal, cleanedUp)
	issueCodes := make([]string, 0)
	for _, check := range checks {
		if !check.Passed {
			issueCodes = append(issueCodes, check.Code)
		}
	}
	status := "passed"
	if len(issueCodes) > 0 {
		status = "failed"
	}

	realProviderCallsMade := any(nil)
	providerMode := "unknown"
	realProviderEnabled := any(nil)
	if cfg.managed {
		realProviderCallsMade = false
		providerMode = health.ProviderMode
		realProviderEnabled = health.RealProviderEnabled
	}

	mode := "external-observation"
	if cfg.managed {
		mode = "managed-local-fake"
	}

	return report{
		SchemaVersion:      2,
		MethodologyVersion: methodologyVersion,
		Status:             status,
		GeneratedAt:        time.Now().UTC().Format(time.RFC3339Nano),
		StartedAt:          startedAt.Format(time.RFC3339Nano),
		TotalDurationMS:    roundMS(time.Since(started)),
		Mode:               mode,
		Target: map[string]any{
			"endpoint":             sanitizeTarget(endpoint),
			"model":                cfg.model,
			"managed":              cfg.managed,
			"credentialsSupported": false,
		},
		Workload: map[string]any{
			"arrivalModel":      "open-loop-fixed-rate",
			"durationMs":        cfg.duration.Milliseconds(),
			"targetRps":         cfg.rateRPS,
			"maxOutstanding":    cfg.maxOutstanding,
			"managedMaxInFlight": cfg.maxInFlight,
			"requestTimeoutMs":  cfg.requestTimeout.Milliseconds(),
			"burstRequests":     cfg.burstRequests,
			"interruptRequests": cfg.interruptRequests,
		},
		Thresholds: map[string]any{
			"maxP95Ms":             cfg.maxP95.Milliseconds(),
			"maxSchedulerLagP95Ms": cfg.maxSchedulerLagP95.Milliseconds(),
			"minArrivalRatio":      cfg.minArrivalRatio,
			"maxErrorRate":         cfg.maxErrorRate,
			"minOverloadRejected":  1,
			"minManagedInFlightForLatency": minimumManagedInFlight(cfg),
		},
		Environment: map[string]any{
			"goVersion":       runtime.Version(),
			"platform":        runtime.GOOS,
			"architecture":    runtime.GOARCH,
			"logicalCpuCount": runtime.NumCPU(),
			"ci":              os.Getenv("CI") == "true",
		},
		Safety: map[string]any{
			"providerMode":                   providerMode,
			"realProviderEnabled":            realProviderEnabled,
			"realProviderCallsMade":          realProviderCallsMade,
			"credentialEnvironmentForwarded": false,
			"authorizationHeaderSupported":   false,
			"managedGatewayCleanedUp":        cleanedUp,
		},
		OpenLoop:           openLoop,
		Backpressure:       backpressure,
		Interruption:       interruption,
		Checks:             checks,
		IssueCodes:         issueCodes,
		FatalError:         fatal,
		ComparisonBoundary: "These measurements describe this target on this host and workload only. They do not prove production readiness or superiority without same-host, same-upstream, same-arrival-model comparative runs.",
	}
}

func parseConfig(args []string) (config, bool, error) {
	cleanArgs := make([]string, 0, len(args))
	for _, arg := range args {
		if arg != "--" {
			cleanArgs = append(cleanArgs, arg)
		}
	}

	repoRoot, err := findRepoRoot()
	if err != nil {
		return config{}, false, err
	}
	defaults := config{
		repoRoot:           repoRoot,
		output:             filepath.Join(repoRoot, ".tmp", "gateway-soak-benchmark.json"),
		model:              "local-fake-model",
		duration:           5 * time.Second,
		rateRPS:            100,
		maxOutstanding:     128,
		requestTimeout:     5 * time.Second,
		maxP95:             750 * time.Millisecond,
		maxSchedulerLagP95: 100 * time.Millisecond,
		minArrivalRatio:    0.90,
		maxErrorRate:       0,
		maxInFlight:        80,
		burstRequests:      256,
		interruptRequests:  8,
	}

	fs := flag.NewFlagSet("gateway-soak", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var showHelp bool
	fs.StringVar(&defaults.target, "target", "", "complete credential-free chat-completions endpoint")
	fs.StringVar(&defaults.output, "output", defaults.output, "JSON evidence path")
	fs.StringVar(&defaults.model, "model", defaults.model, "model id")
	fs.DurationVar(&defaults.duration, "duration", defaults.duration, "open-loop duration")
	fs.Float64Var(&defaults.rateRPS, "rate", defaults.rateRPS, "open-loop target requests per second")
	fs.IntVar(&defaults.maxOutstanding, "max-outstanding", defaults.maxOutstanding, "client outstanding request cap")
	fs.DurationVar(&defaults.requestTimeout, "timeout", defaults.requestTimeout, "per-request timeout")
	fs.DurationVar(&defaults.maxP95, "max-p95", defaults.maxP95, "latency p95 threshold")
	fs.DurationVar(&defaults.maxSchedulerLagP95, "max-scheduler-lag-p95", defaults.maxSchedulerLagP95, "scheduler lag p95 threshold")
	fs.Float64Var(&defaults.minArrivalRatio, "min-arrival-ratio", defaults.minArrivalRatio, "minimum started/scheduled ratio")
	fs.Float64Var(&defaults.maxErrorRate, "max-error-rate", defaults.maxErrorRate, "maximum sustained error ratio")
	fs.IntVar(&defaults.maxInFlight, "managed-max-in-flight", defaults.maxInFlight, "managed gateway in-flight limit")
	fs.IntVar(&defaults.burstRequests, "burst-requests", defaults.burstRequests, "backpressure burst size")
	fs.IntVar(&defaults.interruptRequests, "interrupt-requests", defaults.interruptRequests, "stream connections to interrupt")
	fs.BoolVar(&defaults.faultProbes, "fault-probes", false, "enable fault probes for an external target")
	fs.BoolVar(&defaults.jsonOutput, "json", false, "emit compact JSON")
	fs.BoolVar(&showHelp, "help", false, "show help")
	fs.BoolVar(&showHelp, "h", false, "show help")
	if err := fs.Parse(cleanArgs); err != nil {
		return config{}, false, err
	}
	if showHelp {
		return defaults, true, nil
	}
	if fs.NArg() > 0 {
		return config{}, false, fmt.Errorf("unexpected arguments: %s", strings.Join(fs.Args(), ", "))
	}

	defaults.managed = strings.TrimSpace(defaults.target) == ""
	defaults.faultProbes = defaults.managed || defaults.faultProbes
	if !defaults.managed {
		target, err := validateTarget(defaults.target)
		if err != nil {
			return config{}, false, err
		}
		defaults.target = target
	}
	if !filepath.IsAbs(defaults.output) {
		defaults.output = filepath.Join(repoRoot, defaults.output)
	}
	if defaults.duration <= 0 || defaults.rateRPS <= 0 || defaults.maxOutstanding <= 0 || defaults.requestTimeout <= 0 {
		return config{}, false, errors.New("duration, rate, max-outstanding, and timeout must be positive")
	}
	if defaults.maxP95 <= 0 || defaults.maxSchedulerLagP95 <= 0 {
		return config{}, false, errors.New("latency and scheduler thresholds must be positive")
	}
	if defaults.minArrivalRatio < 0 || defaults.minArrivalRatio > 1 || defaults.maxErrorRate < 0 || defaults.maxErrorRate > 1 {
		return config{}, false, errors.New("ratio thresholds must be between 0 and 1")
	}
	if defaults.maxInFlight <= 0 || defaults.burstRequests <= defaults.maxInFlight || defaults.interruptRequests <= 0 {
		return config{}, false, errors.New("managed limits require max-in-flight > 0, burst-requests > max-in-flight, and interrupt-requests > 0")
	}
	if defaults.managed && defaults.maxErrorRate == 0 {
		minimum := minimumManagedInFlight(defaults)
		if defaults.maxInFlight < minimum {
			return config{}, false, fmt.Errorf(
				"managed max-in-flight must be at least %d for %.2f RPS, %s max-p95, zero tolerated sustained errors, and safety headroom",
				minimum,
				defaults.rateRPS,
				defaults.maxP95,
			)
		}
		if defaults.maxOutstanding < defaults.maxInFlight {
			return config{}, false, errors.New("managed max-outstanding must be at least max-in-flight")
		}
	}
	return defaults, false, nil
}

func minimumManagedInFlight(cfg config) int {
	const safetyHeadroom = 5
	return int(math.Ceil(cfg.rateRPS*cfg.maxP95.Seconds())) + safetyHeadroom
}

func findRepoRoot() (string, error) {
	current, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for i := 0; i < 8; i++ {
		if fileExists(filepath.Join(current, "package.json")) && fileExists(filepath.Join(current, "apps", "ai-gateway-service", "src", "index.js")) {
			return current, nil
		}
		parent := filepath.Dir(current)
		if parent == current {
			break
		}
		current = parent
	}
	return "", errors.New("repository root not found")
}

func startManagedGateway(cfg config) (*managedGateway, error) {
	port, err := reservePort()
	if err != nil {
		return nil, err
	}
	node, err := exec.LookPath("node")
	if err != nil {
		return nil, fmt.Errorf("node executable not found: %w", err)
	}
	serviceRoot := filepath.Join(cfg.repoRoot, "apps", "ai-gateway-service")
	entrypoint := filepath.Join(serviceRoot, "src", "index.js")
	baseURL := "http://127.0.0.1:" + strconv.Itoa(port)
	stdout := &boundedBuffer{}
	stderr := &boundedBuffer{}
	cmd := exec.Command(node, entrypoint)
	cmd.Dir = serviceRoot
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	cmd.Env = append(minimalEnvironment(),
		"AI_GATEWAY_SERVICE_HOST=127.0.0.1",
		"AI_GATEWAY_SERVICE_PORT="+strconv.Itoa(port),
		"AI_GATEWAY_PROVIDER_MODE=fake",
		"AI_GATEWAY_REAL_PROVIDER_ENABLED=false",
		"AI_GATEWAY_ROUTE_MODE=registry-default",
		"AI_GATEWAY_DEFAULT_PROVIDER=local-fake-provider",
		"AI_GATEWAY_RATE_LIMIT_WHITELIST=127.0.0.1,::1,::ffff:127.0.0.1",
		"AI_GATEWAY_MAX_IN_FLIGHT_REQUESTS="+strconv.Itoa(cfg.maxInFlight),
		"AI_GATEWAY_MAX_REQUEST_BODY_BYTES=4096",
		"AI_GATEWAY_USAGE_LOG_DIR="+filepath.Join(cfg.repoRoot, ".tmp", "gateway-soak-usage-"+strconv.Itoa(port)),
		"PME_ENTERPRISE_AUTH_ENABLED=false",
	)
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	gateway := &managedGateway{
		cmd:     cmd,
		wait:    make(chan error, 1),
		baseURL: baseURL,
		stdout:  stdout,
		stderr:  stderr,
	}
	go func() { gateway.wait <- cmd.Wait() }()

	health, err := waitForHealth(gateway, 20*time.Second)
	if err != nil {
		stopManagedGateway(gateway)
		return nil, err
	}
	if health.ProviderMode != "fake" || health.RealProviderEnabled {
		stopManagedGateway(gateway)
		return nil, fmt.Errorf("managed gateway safety mismatch: providerMode=%s realProviderEnabled=%t", health.ProviderMode, health.RealProviderEnabled)
	}
	gateway.health = health
	return gateway, nil
}

func waitForHealth(gateway *managedGateway, timeout time.Duration) (healthResult, error) {
	deadline := time.Now().Add(timeout)
	client := &http.Client{Timeout: time.Second}
	for time.Now().Before(deadline) {
		select {
		case err := <-gateway.wait:
			return healthResult{}, fmt.Errorf("gateway exited before readiness: %v; %s", err, outputTail(gateway))
		default:
		}
		health := fetchHealth(client, gateway.baseURL)
		if health.OK {
			return health, nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	return healthResult{}, fmt.Errorf("gateway readiness timed out: %s", outputTail(gateway))
}

func stopManagedGateway(gateway *managedGateway) bool {
	if gateway == nil || gateway.cmd == nil || gateway.cmd.Process == nil {
		return true
	}
	err := gateway.cmd.Process.Kill()
	if err != nil && !errors.Is(err, os.ErrProcessDone) {
		return false
	}
	select {
	case <-gateway.wait:
		return true
	case <-time.After(5 * time.Second):
		return false
	}
}

func runOpenLoop(client *http.Client, endpoint string, cfg config) *openLoopSummary {
	total := int(math.Round(cfg.duration.Seconds() * cfg.rateRPS))
	if total < 1 {
		total = 1
	}
	results := make(chan requestResult, total)
	semaphore := make(chan struct{}, cfg.maxOutstanding)
	var wait sync.WaitGroup
	var outstanding atomic.Int64
	var maxOutstanding atomic.Int64
	schedulerLags := make([]float64, 0, total)
	dropped := 0
	startedCount := 0
	phaseStarted := time.Now()

	for index := 0; index < total; index++ {
		intended := phaseStarted.Add(time.Duration(float64(index) * float64(time.Second) / cfg.rateRPS))
		if delay := time.Until(intended); delay > 0 {
			time.Sleep(delay)
		}
		schedulerLags = append(schedulerLags, roundMS(time.Since(intended)))
		select {
		case semaphore <- struct{}{}:
			startedCount++
			wait.Add(1)
			current := outstanding.Add(1)
			for current > maxOutstanding.Load() && !maxOutstanding.CompareAndSwap(maxOutstanding.Load(), current) {
			}
			go func(sequence int) {
				defer wait.Done()
				defer func() {
					<-semaphore
					outstanding.Add(-1)
				}()
				results <- executeChat(client, endpoint, cfg.model, sequence, cfg.managed)
			}(index)
		default:
			dropped++
		}
	}
	wait.Wait()
	close(results)
	wall := time.Since(phaseStarted)

	collected := make([]requestResult, 0, startedCount)
	for result := range results {
		collected = append(collected, result)
	}
	return summarizeOpenLoop(total, startedCount, dropped, int(maxOutstanding.Load()), cfg.rateRPS, wall, schedulerLags, collected)
}

func executeChat(client *http.Client, endpoint, model string, sequence int, requireFake bool) requestResult {
	payload := map[string]any{
		"model":  model,
		"stream": false,
		"messages": []map[string]string{{
			"role":    "user",
			"content": fmt.Sprintf("open-loop soak request %d", sequence),
		}},
	}
	body, _ := json.Marshal(payload)
	started := time.Now()
	request, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return failedRequestResult(started, err)
	}
	request.Header.Set("content-type", "application/json")
	response, err := client.Do(request)
	if err != nil {
		return failedRequestResult(started, err)
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes))
	if err != nil {
		return failedRequestResult(started, err)
	}
	var parsed struct {
		Object  string `json:"object"`
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		UnifiedAI struct {
			ExecutionMode string `json:"execution_mode"`
		} `json:"unified_ai"`
	}
	parseErr := json.Unmarshal(responseBody, &parsed)
	protocolValid := response.StatusCode == http.StatusOK && parseErr == nil && parsed.Object == "chat.completion" && len(parsed.Choices) > 0 && parsed.Choices[0].Message.Content != ""
	safetyValid := !requireFake || parsed.UnifiedAI.ExecutionMode == "fake"
	return requestResult{
		status:        response.StatusCode,
		latencyMS:     roundMS(time.Since(started)),
		ok:            protocolValid && safetyValid,
		protocolValid: protocolValid,
		safetyValid:   safetyValid,
	}
}

func failedRequestResult(started time.Time, err error) requestResult {
	return requestResult{
		latencyMS: roundMS(time.Since(started)),
		timedOut:  errors.Is(err, context.DeadlineExceeded) || os.IsTimeout(err),
		errCode:   errorCode(err),
	}
}

func summarizeOpenLoop(scheduled, started, dropped, maxOutstanding int, targetRPS float64, wall time.Duration, schedulerLags []float64, results []requestResult) *openLoopSummary {
	summary := &openLoopSummary{
		Scheduled:              scheduled,
		Started:                started,
		ClientDropped:          dropped,
		Completed:              len(results),
		TargetRPS:              targetRPS,
		MaxOutstandingObserved: maxOutstanding,
		StatusCodes:            map[string]int{},
		SchedulerLagMS:         summarizeMetric(schedulerLags),
		WallDurationMS:         roundMS(wall),
	}
	latencies := make([]float64, 0, len(results))
	for _, result := range results {
		key := "transport_error"
		if result.status > 0 {
			key = strconv.Itoa(result.status)
		}
		summary.StatusCodes[key]++
		if result.ok {
			summary.Succeeded++
			latencies = append(latencies, result.latencyMS)
		} else {
			summary.Failed++
		}
		if result.protocolValid {
			summary.ProtocolValid++
		}
		if result.safetyValid {
			summary.SafetyValid++
		}
		if result.timedOut {
			summary.Timeouts++
		}
		if result.errCode != "" {
			summary.TransportErrors++
		}
	}
	summary.LatencyMS = summarizeMetric(latencies)
	wallSeconds := wall.Seconds()
	if wallSeconds > 0 {
		summary.StartedRPS = round(float64(started) / wallSeconds)
		summary.SuccessfulRPS = round(float64(summary.Succeeded) / wallSeconds)
	}
	summary.ArrivalRatio = ratio(started, scheduled)
	summary.ErrorRate = ratio(summary.Failed+dropped, scheduled)
	summary.ProtocolValidityRate = ratio(summary.ProtocolValid, started)
	return summary
}

func runBackpressure(client *http.Client, endpoint, baseURL string, cfg config) backpressureSummary {
	result := backpressureSummary{
		Status:      "failed",
		Attempted:   cfg.burstRequests,
		StatusCodes: map[string]int{},
	}
	var wait sync.WaitGroup
	var mu sync.Mutex
	start := make(chan struct{})
	for index := 0; index < cfg.burstRequests; index++ {
		wait.Add(1)
		go func(sequence int) {
			defer wait.Done()
			<-start
			status, body, err := executeStreamingDrain(client, endpoint, cfg.model, sequence)
			mu.Lock()
			defer mu.Unlock()
			key := "transport_error"
			if status > 0 {
				key = strconv.Itoa(status)
			}
			result.StatusCodes[key]++
			if err == nil && status == http.StatusOK && bytes.Contains(body, []byte("data: [DONE]")) {
				result.Accepted++
			} else if err == nil && status == http.StatusServiceUnavailable && bytes.Contains(body, []byte("service_overloaded")) {
				result.OverloadRejected++
			} else {
				result.Unexpected++
			}
		}(index)
	}
	close(start)
	wait.Wait()
	time.Sleep(250 * time.Millisecond)
	recovery := executeChat(client, endpoint, cfg.model, -1, cfg.managed)
	result.RecoveryRequestOK = recovery.ok
	result.RecoveryHealthOK = fetchHealth(client, baseURL).OK
	if result.Accepted > 0 && result.OverloadRejected > 0 && result.Unexpected == 0 && result.RecoveryRequestOK && result.RecoveryHealthOK {
		result.Status = "passed"
	}
	return result
}

func executeStreamingDrain(client *http.Client, endpoint, model string, sequence int) (int, []byte, error) {
	payload := map[string]any{
		"model":  model,
		"stream": true,
		"messages": []map[string]string{{
			"role":    "user",
			"content": fmt.Sprintf("backpressure stream %d", sequence),
		}},
	}
	body, _ := json.Marshal(payload)
	request, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return 0, nil, err
	}
	request.Header.Set("content-type", "application/json")
	request.Header.Set("accept", "text/event-stream")
	response, err := client.Do(request)
	if err != nil {
		return 0, nil, err
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes))
	return response.StatusCode, responseBody, err
}

func runInterruption(client *http.Client, endpoint, baseURL string, cfg config) interruptionSummary {
	result := interruptionSummary{Status: "failed", Attempted: cfg.interruptRequests}
	var wait sync.WaitGroup
	var mu sync.Mutex
	start := make(chan struct{})
	for index := 0; index < cfg.interruptRequests; index++ {
		wait.Add(1)
		go func(sequence int) {
			defer wait.Done()
			<-start
			headers, firstBytes, closed, err := interruptStreamingRequest(client, endpoint, cfg.model, sequence)
			mu.Lock()
			defer mu.Unlock()
			if headers {
				result.HeadersReceived++
			}
			if firstBytes {
				result.FirstBytesRead++
			}
			if closed {
				result.ConnectionsClosed++
			}
			if err != nil {
				result.Unexpected++
			}
		}(index)
	}
	close(start)
	wait.Wait()
	time.Sleep(250 * time.Millisecond)
	recovery := executeChat(client, endpoint, cfg.model, -2, cfg.managed)
	result.RecoveryRequestOK = recovery.ok
	result.RecoveryHealthOK = fetchHealth(client, baseURL).OK
	if result.HeadersReceived == result.Attempted && result.FirstBytesRead == result.Attempted && result.ConnectionsClosed == result.Attempted && result.Unexpected == 0 && result.RecoveryRequestOK && result.RecoveryHealthOK {
		result.Status = "passed"
	}
	return result
}

func interruptStreamingRequest(client *http.Client, endpoint, model string, sequence int) (bool, bool, bool, error) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	payload := map[string]any{
		"model":  model,
		"stream": true,
		"messages": []map[string]string{{
			"role":    "user",
			"content": fmt.Sprintf("interrupt stream %d", sequence),
		}},
	}
	body, _ := json.Marshal(payload)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return false, false, false, err
	}
	request.Header.Set("content-type", "application/json")
	request.Header.Set("accept", "text/event-stream")
	response, err := client.Do(request)
	if err != nil {
		return false, false, false, err
	}
	if response.StatusCode != http.StatusOK {
		response.Body.Close()
		return true, false, true, fmt.Errorf("unexpected interruption status %d", response.StatusCode)
	}
	buffer := make([]byte, 512)
	n, readErr := response.Body.Read(buffer)
	cancel()
	closeErr := response.Body.Close()
	if readErr != nil && !errors.Is(readErr, io.EOF) {
		return true, n > 0, closeErr == nil, readErr
	}
	return true, n > 0, closeErr == nil, closeErr
}

func fetchHealth(client *http.Client, baseURL string) healthResult {
	if baseURL == "" {
		return healthResult{}
	}
	response, err := client.Get(strings.TrimRight(baseURL, "/") + "/health/check")
	if err != nil {
		return healthResult{}
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes))
	if err != nil {
		return healthResult{StatusCode: response.StatusCode}
	}
	var envelope struct {
		Data struct {
			Status              string `json:"status"`
			ProviderMode        string `json:"providerMode"`
			RealProviderEnabled bool   `json:"realProviderEnabled"`
		} `json:"data"`
	}
	if json.Unmarshal(body, &envelope) != nil {
		return healthResult{StatusCode: response.StatusCode}
	}
	return healthResult{
		OK:                  response.StatusCode == http.StatusOK && envelope.Data.Status == "ready",
		StatusCode:          response.StatusCode,
		Status:              envelope.Data.Status,
		ProviderMode:        envelope.Data.ProviderMode,
		RealProviderEnabled: envelope.Data.RealProviderEnabled,
	}
}

func buildChecks(cfg config, health healthResult, openLoop *openLoopSummary, backpressure backpressureSummary, interruption interruptionSummary, fatal *errorResult, cleanedUp any) []checkResult {
	checks := []checkResult{
		check("benchmark_completed", fatal == nil, "benchmark completes without a fatal error", valueOrNil(fatal)),
		check("open_loop_completed", openLoop != nil && openLoop.Completed == openLoop.Started, "every started open-loop request completes", field(openLoop, func(v *openLoopSummary) any { return map[string]int{"started": v.Started, "completed": v.Completed} })),
		check("open_loop_no_client_drop", openLoop != nil && openLoop.ClientDropped == 0, "client generator drops no scheduled arrivals", field(openLoop, func(v *openLoopSummary) any { return v.ClientDropped })),
		check("open_loop_arrival_ratio", openLoop != nil && openLoop.ArrivalRatio >= cfg.minArrivalRatio, fmt.Sprintf("started/scheduled ratio >= %.2f", cfg.minArrivalRatio), field(openLoop, func(v *openLoopSummary) any { return v.ArrivalRatio })),
		check("open_loop_error_rate", openLoop != nil && openLoop.ErrorRate <= cfg.maxErrorRate, fmt.Sprintf("sustained error rate <= %.4f", cfg.maxErrorRate), field(openLoop, func(v *openLoopSummary) any { return v.ErrorRate })),
		check("open_loop_protocol_valid", openLoop != nil && openLoop.ProtocolValidityRate == 1, "all started sustained requests satisfy the OpenAI response contract", field(openLoop, func(v *openLoopSummary) any { return v.ProtocolValidityRate })),
		check("open_loop_latency_p95", openLoop != nil && metricWithin(openLoop.LatencyMS.P95, cfg.maxP95), fmt.Sprintf("sustained latency p95 <= %s", cfg.maxP95), field(openLoop, func(v *openLoopSummary) any { return v.LatencyMS.P95 })),
		check("open_loop_scheduler_lag_p95", openLoop != nil && metricWithin(openLoop.SchedulerLagMS.P95, cfg.maxSchedulerLagP95), fmt.Sprintf("scheduler lag p95 <= %s", cfg.maxSchedulerLagP95), field(openLoop, func(v *openLoopSummary) any { return v.SchedulerLagMS.P95 })),
	}
	if cfg.faultProbes {
		checks = append(checks,
			check("backpressure_observed", backpressure.Status == "passed", "controlled burst produces explicit overload rejection and then recovers", backpressure),
			check("interruption_recovered", interruption.Status == "passed", "client-aborted streams are closed and normal traffic recovers", interruption),
		)
	}
	if cfg.managed {
		checks = append(checks,
			check("managed_fake_only", health.OK && health.ProviderMode == "fake" && !health.RealProviderEnabled && openLoop != nil && openLoop.SafetyValid == openLoop.Started, "managed load remains fake-only with real providers disabled", map[string]any{"health": health, "safetyValid": field(openLoop, func(v *openLoopSummary) any { return v.SafetyValid })}),
			check("managed_gateway_cleaned_up", cleanedUp == true, "managed gateway process exits after all phases", cleanedUp),
		)
	}
	return checks
}

func newHTTPClient(cfg config) *http.Client {
	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		MaxIdleConns:          cfg.maxOutstanding * 2,
		MaxIdleConnsPerHost:   cfg.maxOutstanding,
		MaxConnsPerHost:       cfg.maxOutstanding,
		IdleConnTimeout:       30 * time.Second,
		ResponseHeaderTimeout: cfg.requestTimeout,
		DisableCompression:    true,
	}
	return &http.Client{Transport: transport, Timeout: cfg.requestTimeout}
}

func summarizeMetric(values []float64) metricSummary {
	filtered := make([]float64, 0, len(values))
	for _, value := range values {
		if !math.IsNaN(value) && !math.IsInf(value, 0) {
			filtered = append(filtered, value)
		}
	}
	if len(filtered) == 0 {
		return metricSummary{}
	}
	sort.Float64s(filtered)
	mean := 0.0
	for _, value := range filtered {
		mean += value
	}
	mean /= float64(len(filtered))
	min := round(filtered[0])
	avg := round(mean)
	p50 := round(percentile(filtered, 0.50))
	p95 := round(percentile(filtered, 0.95))
	p99 := round(percentile(filtered, 0.99))
	max := round(filtered[len(filtered)-1])
	return metricSummary{Samples: len(filtered), Min: &min, Mean: &avg, P50: &p50, P95: &p95, P99: &p99, Max: &max}
}

func percentile(sorted []float64, quantile float64) float64 {
	rank := int(math.Ceil(quantile*float64(len(sorted)))) - 1
	if rank < 0 {
		rank = 0
	}
	if rank >= len(sorted) {
		rank = len(sorted) - 1
	}
	return sorted[rank]
}

func validateTarget(raw string) (string, error) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", errors.New("target must use http or https")
	}
	if parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("target must be complete and contain no credentials, query parameters, or fragment")
	}
	return strings.TrimRight(parsed.String(), "/"), nil
}

func sanitizeTarget(raw string) string {
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "invalid"
	}
	parsed.User = nil
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return parsed.String()
}

func gatewayBaseURL(gateway *managedGateway, endpoint string) string {
	if gateway != nil {
		return gateway.baseURL
	}
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return ""
	}
	return parsed.Scheme + "://" + parsed.Host
}

func minimalEnvironment() []string {
	allowed := map[string]bool{
		"PATH": true, "Path": true, "PATHEXT": true, "SystemRoot": true, "WINDIR": true,
		"TEMP": true, "TMP": true, "TMPDIR": true, "HOME": true, "USERPROFILE": true,
		"LOCALAPPDATA": true, "APPDATA": true, "NODE_OPTIONS": true, "NODE_PATH": true,
		"CI": true, "GITHUB_ACTIONS": true, "FORCE_COLOR": true, "NO_COLOR": true,
	}
	result := make([]string, 0)
	for _, entry := range os.Environ() {
		name := strings.SplitN(entry, "=", 2)[0]
		if allowed[name] {
			result = append(result, entry)
		}
	}
	return result
}

func reservePort() (int, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer listener.Close()
	return listener.Addr().(*net.TCPAddr).Port, nil
}

func outputTail(gateway *managedGateway) string {
	combined := strings.TrimSpace(gateway.stdout.String() + "\n" + gateway.stderr.String())
	if len(combined) > 4000 {
		return combined[len(combined)-4000:]
	}
	return combined
}

func writeReport(path string, value report) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	encoded, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	encoded = append(encoded, '\n')
	temporary, err := os.CreateTemp(filepath.Dir(path), ".gateway-soak-*.tmp")
	if err != nil {
		return err
	}
	temporaryName := temporary.Name()
	defer os.Remove(temporaryName)
	if _, err := temporary.Write(encoded); err != nil {
		temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	if runtime.GOOS == "windows" {
		_ = os.Remove(path)
	}
	return os.Rename(temporaryName, path)
}

func printSummary(value report, output string) {
	open := value.OpenLoop
	if open == nil {
		fmt.Printf("Gateway open-loop soak: %s\nEvidence: %s\n", value.Status, output)
		return
	}
	latencyP95 := any(nil)
	lagP95 := any(nil)
	if open.LatencyMS.P95 != nil {
		latencyP95 = *open.LatencyMS.P95
	}
	if open.SchedulerLagMS.P95 != nil {
		lagP95 = *open.SchedulerLagMS.P95
	}
	fmt.Printf("Gateway open-loop soak: %s\n", value.Status)
	fmt.Printf("Sustained: %d/%d success at %.2f RPS, p95=%vms, scheduler-lag-p95=%vms\n", open.Succeeded, open.Scheduled, open.SuccessfulRPS, latencyP95, lagP95)
	fmt.Printf("Backpressure: %s (%d overload rejections)\n", value.Backpressure.Status, value.Backpressure.OverloadRejected)
	fmt.Printf("Interruption recovery: %s\n", value.Interruption.Status)
	fmt.Printf("Evidence: %s\n", output)
}

func printHelp() {
	fmt.Print(`Credential-free Go open-loop and resilience benchmark.

Usage:
  go run ./tools/gateway-soak/main.go [options]

Options:
  --target <url>                 External chat-completions endpoint; defaults to managed fake gateway.
  --duration <duration>          Sustained fixed-arrival duration (default 5s).
  --rate <rps>                   Target fixed arrival rate (default 100).
  --max-outstanding <count>      Client outstanding cap (default 128).
  --timeout <duration>           Per-request timeout (default 5s).
  --max-p95 <duration>           Sustained latency p95 threshold (default 750ms).
  --max-scheduler-lag-p95 <dur>  Scheduler lag p95 threshold (default 100ms).
  --min-arrival-ratio <0..1>     Minimum started/scheduled ratio (default 0.90).
  --max-error-rate <0..1>        Maximum sustained error ratio (default 0).
  --managed-max-in-flight <n>    Managed service in-flight cap (default 80).
  --burst-requests <n>           Concurrent streaming backpressure burst (default 256).
  --interrupt-requests <n>       Streaming connections to abort (default 8).
  --fault-probes                 Explicitly enable disruptive probes for an external target.
  --model <id>                   Request model (default local-fake-model).
  --output <path>                JSON evidence output.
  --json                         Emit compact JSON to stdout.
  --help                         Show help.

No authorization headers or provider credentials are accepted.
`)
}

func skippedBackpressure(reason string) backpressureSummary {
	return backpressureSummary{Status: "skipped", Reason: reason, StatusCodes: map[string]int{}, RecoveryRequestOK: false, RecoveryHealthOK: false, Unexpected: 0, Attempted: 0, Accepted: 0, OverloadRejected: 0}
}

func skippedInterruption(reason string) interruptionSummary {
	return interruptionSummary{Status: "skipped", Reason: reason}
}

func check(code string, passed bool, expectation string, actual any) checkResult {
	return checkResult{Code: code, Passed: passed, Expectation: expectation, Actual: actual}
}

func field(value *openLoopSummary, getter func(*openLoopSummary) any) any {
	if value == nil {
		return nil
	}
	return getter(value)
}

func valueOrNil(value *errorResult) any {
	if value == nil {
		return "complete"
	}
	return value.Message
}

func metricWithin(value *float64, threshold time.Duration) bool {
	return value != nil && *value <= float64(threshold)/float64(time.Millisecond)
}

func ratio(numerator, denominator int) float64 {
	if denominator <= 0 {
		return 0
	}
	return round(float64(numerator) / float64(denominator))
}

func round(value float64) float64 {
	return math.Round(value*100) / 100
}

func roundMS(value time.Duration) float64 {
	return round(float64(value) / float64(time.Millisecond))
}

func errorCode(err error) string {
	if err == nil {
		return ""
	}
	if errors.Is(err, context.DeadlineExceeded) || os.IsTimeout(err) {
		return "timeout"
	}
	return "transport_error"
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
