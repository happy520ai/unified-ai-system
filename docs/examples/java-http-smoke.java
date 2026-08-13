import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class java_http_smoke {
  private static String baseUrl(String[] args) {
    for (int index = 0; index + 1 < args.length; index += 1) {
      if (args[index].equals("--base-url")) {
        return args[index + 1].replaceAll("/+$", "");
      }
    }
    return "http://127.0.0.1:3100";
  }

  private static HttpResponse<String> send(
      HttpClient client,
      String method,
      String url,
      String body) throws Exception {
    HttpRequest.Builder builder = HttpRequest.newBuilder()
        .uri(URI.create(url))
        .header("content-type", "application/json");
    if (method.equals("GET")) {
      builder.GET();
    } else {
      builder.POST(HttpRequest.BodyPublishers.ofString(body));
    }
    return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
  }

  private static String jsonBoolean(boolean value) {
    return value ? "true" : "false";
  }

  public static void main(String[] args) throws Exception {
    String baseUrl = baseUrl(args);
    HttpClient client = HttpClient.newHttpClient();
    HttpResponse<String> models = send(client, "GET", baseUrl + "/v1/models", "");
    String chatBody = "{\"model\":\"local-fake-model\",\"messages\":[{\"role\":\"user\",\"content\":\"Java HttpClient runtime test\"}]}";
    HttpResponse<String> chat = send(client, "POST", baseUrl + "/v1/chat/completions", chatBody);
    boolean modelCheck = models.statusCode() == 200
        && models.body().contains("local-fake-model")
        && models.body().contains("local-fake-provider");
    boolean chatCheck = chat.statusCode() == 200 && chat.body().contains("chat.completion");
    boolean fakeCheck = chat.body().contains("\"execution_mode\":\"fake\"");
    boolean contentCheck = chat.body().contains("Java HttpClient runtime test");
    boolean ok = modelCheck && chatCheck && fakeCheck && contentCheck;
    System.out.println("{\"client\":\"http-java-okhttp\",\"sdk\":\"java.net.http.HttpClient\",\"baseUrl\":\""
        + baseUrl + "\",\"checks\":{\"models\":" + jsonBoolean(modelCheck)
        + ",\"chat\":" + jsonBoolean(chatCheck)
        + ",\"fakeProvider\":" + jsonBoolean(fakeCheck)
        + ",\"content\":" + jsonBoolean(contentCheck)
        + "},\"ok\":" + jsonBoolean(ok) + ",\"realProviderCallsMade\":false}");
    if (!ok) {
      System.exit(1);
    }
  }
}
