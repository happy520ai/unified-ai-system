package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type modelList struct {
	Data []struct {
		ID string `json:"id"`
	} `json:"data"`
}

type chatCompletion struct {
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

type smokeResult struct {
	Client                string          `json:"client"`
	SDK                   string          `json:"sdk"`
	BaseURL               string          `json:"baseUrl"`
	Checks                map[string]bool `json:"checks"`
	OK                    bool            `json:"ok"`
	RealProviderCallsMade bool            `json:"realProviderCallsMade"`
}

func main() {
	baseURL := flag.String("base-url", "http://127.0.0.1:3100", "gateway base URL")
	flag.Parse()
	root := strings.TrimRight(*baseURL, "/")
	client := &http.Client{Timeout: 30 * time.Second}

	modelsStatus, modelsBody, err := request(client, http.MethodGet, root+"/v1/models", nil)
	if err != nil {
		fail(err)
	}
	var models modelList
	if err := json.Unmarshal(modelsBody, &models); err != nil {
		fail(err)
	}

	prompt := "Go net/http runtime test"
	payload, err := json.Marshal(map[string]any{
		"model": "local-fake-model",
		"messages": []map[string]string{{"role": "user", "content": prompt}},
	})
	if err != nil {
		fail(err)
	}
	chatStatus, chatBody, err := request(
		client,
		http.MethodPost,
		root+"/v1/chat/completions",
		payload,
	)
	if err != nil {
		fail(err)
	}
	var chat chatCompletion
	if err := json.Unmarshal(chatBody, &chat); err != nil {
		fail(err)
	}

	modelFound := false
	for _, model := range models.Data {
		if model.ID == "local-fake-model" {
			modelFound = true
			break
		}
	}
	content := ""
	if len(chat.Choices) > 0 {
		content = chat.Choices[0].Message.Content
	}
	checks := map[string]bool{
		"models":       modelsStatus == http.StatusOK && modelFound,
		"chat":         chatStatus == http.StatusOK && chat.Object == "chat.completion",
		"content":      strings.Contains(content, prompt),
		"fakeProvider": chat.UnifiedAI.ExecutionMode == "fake" && strings.Contains(content, "[fake:"),
	}
	ok := true
	for _, passed := range checks {
		ok = ok && passed
	}
	result := smokeResult{
		Client:  "http-go-net-http",
		SDK:     "net/http",
		BaseURL: root,
		Checks:  checks,
		OK:      ok,
	}
	encoded, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		fail(err)
	}
	fmt.Println(string(encoded))
	if !ok {
		os.Exit(1)
	}
}

func request(client *http.Client, method string, url string, body []byte) (int, []byte, error) {
	req, err := http.NewRequest(method, url, bytes.NewReader(body))
	if err != nil {
		return 0, nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	response, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(response.Body)
	return response.StatusCode, responseBody, err
}

func fail(err error) {
	encoded, _ := json.Marshal(map[string]any{
		"client":                "http-go-net-http",
		"error":                 err.Error(),
		"ok":                    false,
		"realProviderCallsMade": false,
	})
	fmt.Println(string(encoded))
	os.Exit(1)
}
