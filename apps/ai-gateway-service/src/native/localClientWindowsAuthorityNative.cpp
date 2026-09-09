// Windows-only authority primitives. Protocol/HMAC/checkpoint state remain in TypeScript.
// No shell, user-selected path, service installation, ACL mutation, or readiness override.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#define NAPI_VERSION 8
#include <windows.h>
#include <aclapi.h>
#include <sddl.h>
#include <shlobj.h>
#include <tlhelp32.h>
#include <wincrypt.h>
#include <bcrypt.h>
#include <node_api.h>
#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <cmath>
#include <deque>
#include <functional>
#include <future>
#include <map>
#include <memory>
#include <mutex>
#include <set>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace {
constexpr wchar_t SERVICE[] = L"UnifiedAiSystemLocalClientAuthorityBroker";
constexpr wchar_t SERVICE_SID[] = L"S-1-5-80-2517572854-3647151239-2500651488-2982019916-1580030387";
constexpr wchar_t PIPE[] = L"\\\\.\\pipe\\UnifiedAiSystemLocalClientAuthorityBroker-v1";
constexpr wchar_t MUTEX[] = L"Global\\UnifiedAiSystemLocalClientAuthorityBroker-v1";
constexpr wchar_t REGISTRY[] = L"Software\\UnifiedAISystem\\LocalClientAuthority";
constexpr char NONCE_HEADER[] = "UAI-AUTHORITY-NONCES-V1\n";
constexpr size_t MAX_BYTES = 65536, NONCE_CAPACITY = 4096;
constexpr DWORD FILE_WRITES = FILE_WRITE_DATA | FILE_APPEND_DATA | FILE_WRITE_EA | FILE_WRITE_ATTRIBUTES | DELETE | WRITE_DAC | WRITE_OWNER | FILE_DELETE_CHILD;
constexpr DWORD FILE_ANCESTOR_WRITES = DELETE | WRITE_DAC | WRITE_OWNER | FILE_DELETE_CHILD;
constexpr DWORD KEY_WRITES = KEY_SET_VALUE | KEY_CREATE_SUB_KEY | KEY_CREATE_LINK | DELETE | WRITE_DAC | WRITE_OWNER;
constexpr DWORD KEY_ANCESTOR_WRITES = KEY_SET_VALUE | KEY_CREATE_LINK | DELETE | WRITE_DAC | WRITE_OWNER;
using Clock = std::chrono::steady_clock;
[[noreturn]] void fail() { throw std::runtime_error("LOCAL_CLIENT_WINDOWS_NATIVE_REJECTED"); }
void check(bool ok) { if (!ok) fail(); }
struct Handle {
  HANDLE value = nullptr;
  Handle() = default; explicit Handle(HANDLE valueIn) : value(valueIn) {}
  ~Handle() { reset(); }
  Handle(const Handle&) = delete; Handle& operator=(const Handle&) = delete;
  Handle(Handle&& other) noexcept : value(other.value) { other.value = nullptr; }
  Handle& operator=(Handle&& other) noexcept { if (this != &other) { reset(); value = other.value; other.value = nullptr; } return *this; }
  void reset() { if (value && value != INVALID_HANDLE_VALUE) CloseHandle(value); value = nullptr; }
  explicit operator bool() const { return value && value != INVALID_HANDLE_VALUE; }
};
struct RegKey {
  HKEY value = nullptr;
  RegKey() = default; explicit RegKey(HKEY valueIn) : value(valueIn) {}
  ~RegKey() { if (value) RegCloseKey(value); }
  RegKey(const RegKey&) = delete; RegKey& operator=(const RegKey&) = delete;
  RegKey(RegKey&& other) noexcept : value(other.value) { other.value = nullptr; }
  RegKey& operator=(RegKey&& other) noexcept { if (this != &other) { if (value) RegCloseKey(value); value = other.value; other.value = nullptr; } return *this; }
};
struct LocalMemory { void* value = nullptr; ~LocalMemory() { if (value) LocalFree(value); } };
struct ServiceHandle { SC_HANDLE value = nullptr; ~ServiceHandle() { if (value) CloseServiceHandle(value); } };
std::wstring wide(const std::string& text) {
  check(text.size() <= 1024 * 1024 && text.find('\0') == std::string::npos);
  if (text.empty()) return {};
  int count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, text.data(), static_cast<int>(text.size()), nullptr, 0);
  check(count > 0); std::wstring value(static_cast<size_t>(count), L'\0');
  check(MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, text.data(), static_cast<int>(text.size()), value.data(), count) == count); return value;
}
std::string utf8(const std::wstring& text) {
  if (text.empty()) return {};
  int count = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, text.data(), static_cast<int>(text.size()), nullptr, 0, nullptr, nullptr);
  check(count > 0); std::string value(static_cast<size_t>(count), '\0');
  check(WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, text.data(), static_cast<int>(text.size()), value.data(), count, nullptr, nullptr) == count); return value;
}
bool same(const std::wstring& a, const std::wstring& b) { return CompareStringOrdinal(a.c_str(), static_cast<int>(a.size()), b.c_str(), static_cast<int>(b.size()), TRUE) == CSTR_EQUAL; }
std::wstring programData(DWORD* error = nullptr) {
  if (error) *error = 0;
  PWSTR raw = nullptr; const HRESULT resultCode = SHGetKnownFolderPath(FOLDERID_ProgramData, KF_FLAG_DEFAULT, nullptr, &raw);
  if (FAILED(resultCode)) { if (error) *error = static_cast<DWORD>(resultCode); CoTaskMemFree(raw); fail(); }
  std::wstring result(raw); CoTaskMemFree(raw);
  check(result.size() >= 3 && result[1] == L':' && result[2] == L'\\' && result.find(L"/") == std::wstring::npos);
  while (result.size() > 3 && result.back() == L'\\') result.pop_back(); return result;
}
std::wstring fixedRoot(DWORD* error = nullptr) { return programData(error) + L"\\UnifiedAISystem\\LocalClientAuthority"; }
std::wstring sidText(PSID sid) {
  check(sid && IsValidSid(sid)); LPWSTR raw = nullptr; check(ConvertSidToStringSidW(sid, &raw) != FALSE);
  LocalMemory cleanup{raw}; return raw;
}
bool privilegedSid(const std::wstring& sid) { return sid == SERVICE_SID || sid == L"S-1-5-18" || sid == L"S-1-5-32-544"; }
bool trustedAncestorSid(const std::wstring& sid) {
  if (privilegedSid(sid)) return true;
  // Windows-owned common ancestors may be owned by TrustedInstaller. This does
  // not expand the allowed writers/owners of authority leaves, keys, or mutexes.
  static const std::wstring trustedInstaller = [] {
    DWORD sidSize = 0, domainSize = 0; SID_NAME_USE kind{};
    LookupAccountNameW(nullptr, L"NT SERVICE\\TrustedInstaller", nullptr, &sidSize, nullptr, &domainSize, &kind);
    check(GetLastError() == ERROR_INSUFFICIENT_BUFFER && sidSize > 0 && sidSize <= SECURITY_MAX_SID_SIZE && domainSize <= 256);
    std::vector<BYTE> identity(sidSize); std::vector<wchar_t> domain(domainSize + 1);
    check(LookupAccountNameW(nullptr, L"NT SERVICE\\TrustedInstaller", identity.data(), &sidSize, domain.data(), &domainSize, &kind) != FALSE);
    return sidText(identity.data());
  }();
  return sid == trustedInstaller;
}
std::vector<BYTE> tokenInfo(HANDLE token, TOKEN_INFORMATION_CLASS kind) {
  DWORD size = kind == TokenElevation ? sizeof(TOKEN_ELEVATION) : kind == TokenElevationType ? sizeof(TOKEN_ELEVATION_TYPE) : 0;
  if (size == 0) { GetTokenInformation(token, kind, nullptr, 0, &size); check(GetLastError() == ERROR_INSUFFICIENT_BUFFER); }
  check(size > 0 && size <= 1024 * 1024);
  std::vector<BYTE> data(size); check(GetTokenInformation(token, kind, data.data(), size, &size) != FALSE); return data;
}
Handle processToken(bool duplicate = false) { HANDLE token = nullptr; check(OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY | (duplicate ? TOKEN_DUPLICATE : 0), &token) != FALSE); return Handle(token); }
std::wstring tokenUser(HANDLE token) { auto data = tokenInfo(token, TokenUser); return sidText(reinterpret_cast<TOKEN_USER*>(data.data())->User.Sid); }
Handle callerSelfToken() {
  auto original = processToken(true); HANDLE duplicate = nullptr;
  check(DuplicateTokenEx(original.value, TOKEN_QUERY, nullptr, SecurityImpersonation, TokenImpersonation, &duplicate) != FALSE); return Handle(duplicate);
}
std::string randomId() {
  BYTE bytes[16]; check(BCryptGenRandom(nullptr, bytes, sizeof(bytes), BCRYPT_USE_SYSTEM_PREFERRED_RNG) == 0);
  constexpr char digits[] = "0123456789abcdef"; std::string result; result.reserve(32);
  for (BYTE value : bytes) { result.push_back(digits[value >> 4]); result.push_back(digits[value & 15]); } return result;
}
GENERIC_MAPPING mapping(bool registry) {
  if (registry) return GENERIC_MAPPING{KEY_READ, KEY_WRITE, KEY_EXECUTE, KEY_ALL_ACCESS};
  return GENERIC_MAPPING{FILE_GENERIC_READ, FILE_GENERIC_WRITE, FILE_GENERIC_EXECUTE, FILE_ALL_ACCESS};
}
bool effectiveWrite(PSECURITY_DESCRIPTOR descriptor, HANDLE caller, DWORD writes, bool registry) {
  GENERIC_MAPPING generic = mapping(registry); DWORD granted = 0, size = 4096; BOOL allowed = FALSE;
  std::vector<BYTE> privileges(size);
  BOOL ok = AccessCheck(descriptor, caller, MAXIMUM_ALLOWED, &generic, reinterpret_cast<PRIVILEGE_SET*>(privileges.data()), &size, &granted, &allowed);
  if (!ok && GetLastError() == ERROR_INSUFFICIENT_BUFFER && size <= 65536) {
    privileges.resize(size); ok = AccessCheck(descriptor, caller, MAXIMUM_ALLOWED, &generic, reinterpret_cast<PRIVILEGE_SET*>(privileges.data()), &size, &granted, &allowed);
  }
  check(ok != FALSE); return allowed != FALSE && (granted & writes) != 0;
}
struct AclFacts {
  std::wstring owner; std::set<std::wstring> writers, inherited; bool callerWritable = false, strict = false;
};
AclFacts acl(HANDLE handle, SE_OBJECT_TYPE type, HANDLE caller, bool registry, DWORD writes) {
  PSID owner = nullptr; PACL dacl = nullptr; PSECURITY_DESCRIPTOR descriptor = nullptr;
  check(GetSecurityInfo(handle, type, OWNER_SECURITY_INFORMATION | GROUP_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION, &owner, nullptr, &dacl, nullptr, &descriptor) == ERROR_SUCCESS);
  LocalMemory cleanup{descriptor}; check(dacl && IsValidAcl(dacl));
  AclFacts facts; facts.owner = sidText(owner); facts.strict = privilegedSid(facts.owner);
  for (DWORD i = 0; i < dacl->AceCount; ++i) {
    void* raw = nullptr; check(GetAce(dacl, i, &raw) != FALSE); auto header = static_cast<ACE_HEADER*>(raw);
    // Conditional/object-specific grants need explicit support before this authority may accept them.
    check(header->AceType == ACCESS_ALLOWED_ACE_TYPE || header->AceType == ACCESS_DENIED_ACE_TYPE);
    if (header->AceType != ACCESS_ALLOWED_ACE_TYPE || (header->AceFlags & INHERIT_ONLY_ACE) != 0) continue;
    auto ace = static_cast<ACCESS_ALLOWED_ACE*>(raw); DWORD mask = ace->Mask; auto generic = mapping(registry); MapGenericMask(&mask, &generic);
    if ((mask & writes) == 0) continue;
    auto sid = sidText(&ace->SidStart); facts.writers.insert(sid);
    if ((header->AceFlags & INHERITED_ACE) != 0) facts.inherited.insert(sid);
    if (!privilegedSid(sid)) facts.strict = false;
  }
  if (caller) facts.callerWritable = effectiveWrite(descriptor, caller, writes, registry);
  return facts;
}
std::wstring finalPath(HANDLE handle) {
  std::vector<wchar_t> data(32768); DWORD length = GetFinalPathNameByHandleW(handle, data.data(), static_cast<DWORD>(data.size()), FILE_NAME_NORMALIZED | VOLUME_NAME_DOS);
  check(length > 0 && length < data.size()); std::wstring value(data.data(), length);
  check(value.rfind(L"\\\\?\\", 0) == 0); return value.substr(4);
}
void validateHandle(HANDLE handle, const std::wstring& expected, bool directory) {
  FILE_ATTRIBUTE_TAG_INFO tags{}; check(GetFileInformationByHandleEx(handle, FileAttributeTagInfo, &tags, sizeof(tags)) != FALSE);
  check((tags.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) == 0 && ((tags.FileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0) == directory);
  check(same(finalPath(handle), expected));
}
struct PinnedParents { std::vector<Handle> handles; bool callerCanReplaceAncestor = false; };
PinnedParents pinParents(const std::wstring& file, HANDLE caller) {
  check(file.size() < 32700 && file.size() > 3 && file[1] == L':' && file[2] == L'\\');
  PinnedParents result; std::vector<std::wstring> directories{file.substr(0, 3)};
  for (size_t offset = 3; (offset = file.find(L'\\', offset)) != std::wstring::npos; ++offset) directories.push_back(file.substr(0, offset));
  for (const auto& directory : directories) {
    Handle handle(CreateFileW(directory.c_str(), FILE_READ_ATTRIBUTES | READ_CONTROL, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
    check(static_cast<bool>(handle)); validateHandle(handle.value, directory, true);
    const auto facts = acl(handle.value, SE_FILE_OBJECT, caller, false, FILE_ANCESTOR_WRITES);
    check(trustedAncestorSid(facts.owner) && std::all_of(facts.writers.begin(), facts.writers.end(), trustedAncestorSid));
    if (facts.callerWritable) result.callerCanReplaceAncestor = true;
    result.handles.push_back(std::move(handle));
  }
  return result; // Denying FILE_SHARE_DELETE pins every existing parent against rename/replacement.
}
Handle openFile(const std::wstring& path, DWORD access = FILE_READ_DATA | FILE_READ_ATTRIBUTES | READ_CONTROL) {
  Handle result(CreateFileW(path.c_str(), access, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_SEQUENTIAL_SCAN, nullptr));
  check(static_cast<bool>(result)); validateHandle(result.value, path, false); return result;
}
std::string readBytes(HANDLE file, size_t maximum) {
  LARGE_INTEGER size{}; check(GetFileSizeEx(file, &size) != FALSE && size.QuadPart >= 0 && static_cast<uint64_t>(size.QuadPart) <= maximum);
  std::string result(static_cast<size_t>(size.QuadPart), '\0'); DWORD count = 0;
  if (!result.empty()) check(ReadFile(file, result.data(), static_cast<DWORD>(result.size()), &count, nullptr) != FALSE && count == result.size()); return result;
}
struct Target { std::wstring root, file, registry; };
std::wstring registryDisplay(const Target& target) { return L"HKLM\\" + target.registry; }
struct OpenRegistry { std::vector<RegKey> parents; RegKey target; bool callerCanReplaceAncestor = false; };
OpenRegistry openRegistry(const std::wstring& path, HANDLE caller, bool write = false) {
  OpenRegistry result; HKEY parent = HKEY_LOCAL_MACHINE; size_t start = 0;
  while (start < path.size()) {
    size_t end = path.find(L'\\', start); const bool last = end == std::wstring::npos;
    std::wstring part = path.substr(start, last ? std::wstring::npos : end - start); check(!part.empty());
    HKEY opened = nullptr; DWORD rights = READ_CONTROL | KEY_QUERY_VALUE | KEY_ENUMERATE_SUB_KEYS | KEY_WOW64_64KEY;
    if (last && write) rights |= KEY_SET_VALUE;
    check(RegOpenKeyExW(parent, part.c_str(), REG_OPTION_OPEN_LINK, rights, &opened) == ERROR_SUCCESS); RegKey key(opened);
    DWORD type = 0, bytes = 0; LSTATUS link = RegQueryValueExW(opened, L"SymbolicLinkValue", nullptr, &type, nullptr, &bytes);
    check(link == ERROR_FILE_NOT_FOUND || (link == ERROR_SUCCESS && type != REG_LINK));
    if (last) { result.target = std::move(key); break; }
    if (caller && acl(opened, SE_REGISTRY_KEY, caller, true, KEY_ANCESTOR_WRITES).callerWritable) result.callerCanReplaceAncestor = true;
    result.parents.push_back(std::move(key)); parent = opened; start = end + 1;
  }
  check(result.target.value != nullptr); return result;
}
struct Protection {
  PinnedParents parents; Handle file; OpenRegistry registry; AclFacts rootAcl, fileAcl, registryAcl;
};
Protection protection(const Target& target, HANDLE caller, bool writeRegistry = false) {
  Protection result; result.parents = pinParents(target.file, caller); result.file = openFile(target.file);
  check(!result.parents.handles.empty());
  result.rootAcl = acl(result.parents.handles.back().value, SE_FILE_OBJECT, caller, false, FILE_WRITES);
  result.rootAcl.callerWritable = result.rootAcl.callerWritable || result.parents.callerCanReplaceAncestor;
  result.fileAcl = acl(result.file.value, SE_FILE_OBJECT, caller, false, FILE_WRITES);
  result.registry = openRegistry(target.registry, caller, writeRegistry);
  result.registryAcl = acl(result.registry.target.value, SE_REGISTRY_KEY, caller, true, KEY_WRITES);
  result.registryAcl.callerWritable = result.registryAcl.callerWritable || result.registry.callerCanReplaceAncestor; return result;
}
void requireProtection(const Protection& value) {
  for (const AclFacts* item : {&value.rootAcl, &value.fileAcl, &value.registryAcl}) {
    check(item->strict && !item->callerWritable && item->writers.count(SERVICE_SID) == 1);
  }
}
void verifyProtectedBinary(const std::wstring& path, HANDLE caller = nullptr) {
  auto parents = pinParents(path, caller); check(!parents.callerCanReplaceAncestor);
  const auto root = fixedRoot();
  for (auto& handle : parents.handles) {
    const auto current = finalPath(handle.value);
    if (current.size() >= root.size() && same(current.substr(0, root.size()), root)) {
      auto facts = acl(handle.value, SE_FILE_OBJECT, caller, false, FILE_WRITES); check(facts.strict && !facts.callerWritable);
    }
  }
  auto file = openFile(path); auto facts = acl(file.value, SE_FILE_OBJECT, caller, false, FILE_WRITES); check(facts.strict && !facts.callerWritable);
}
std::wstring processImage(HANDLE process, DWORD* error = nullptr) {
  std::vector<wchar_t> data(32768); DWORD length = static_cast<DWORD>(data.size());
  if (QueryFullProcessImageNameW(process, 0, data.data(), &length) == FALSE) {
    const DWORD saved = GetLastError(); if (error) *error = saved; fail();
  }
  return std::wstring(data.data(), length);
}
DWORD servicePid(bool permitStarting = false, const char** diagnostic = nullptr, DWORD* error = nullptr) {
  const auto stage = [&](const char* code) { if (diagnostic) *diagnostic = code; if (error) *error = 0; };
  const auto api = [&](bool ok) { if (!ok) { const DWORD saved = GetLastError(); if (error) *error = saved; fail(); } };
  stage("LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SCM_CONNECT_REJECTED");
  ServiceHandle manager{OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CONNECT)}; api(manager.value != nullptr);
  stage("LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SCM_SERVICE_OPEN_REJECTED");
  ServiceHandle service{OpenServiceW(manager.value, SERVICE, SERVICE_QUERY_STATUS | SERVICE_QUERY_CONFIG)}; api(service.value != nullptr);
  SERVICE_STATUS_PROCESS status{}; DWORD needed = 0;
  stage("LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SCM_STATUS_REJECTED");
  api(QueryServiceStatusEx(service.value, SC_STATUS_PROCESS_INFO, reinterpret_cast<BYTE*>(&status), sizeof(status), &needed) != FALSE);
  stage("LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SCM_RUNNING_REJECTED");
  check(status.dwProcessId != 0 && (status.dwCurrentState == SERVICE_RUNNING || (permitStarting && status.dwCurrentState == SERVICE_START_PENDING)));
  stage("LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SCM_CONFIG_SIZE_REJECTED");
  QueryServiceConfigW(service.value, nullptr, 0, &needed); const DWORD sizeError = GetLastError();
  if (sizeError != ERROR_INSUFFICIENT_BUFFER) { if (error) *error = sizeError; fail(); }
  check(needed <= 65536);
  stage("LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SCM_CONFIG_VALUE_REJECTED");
  std::vector<BYTE> bytes(needed); api(QueryServiceConfigW(service.value, reinterpret_cast<QUERY_SERVICE_CONFIGW*>(bytes.data()), needed, &needed) != FALSE);
  auto config = reinterpret_cast<QUERY_SERVICE_CONFIGW*>(bytes.data());
  stage("LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SCM_KNOWN_FOLDER_REJECTED");
  const auto image = fixedRoot(error) + L"\\bin\\authority-broker-host.exe";
  stage("LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SCM_CONFIG_TYPE_REJECTED");
  check(config->dwServiceType == SERVICE_WIN32_OWN_PROCESS);
  stage("LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SCM_START_TYPE_REJECTED");
  check(config->dwStartType == SERVICE_DEMAND_START);
  stage("LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SCM_CONFIG_PATH_REJECTED");
  check(same(config->lpBinaryPathName, L"\"" + image + L"\" --service"));
  stage("LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SCM_CONFIG_ACCOUNT_REJECTED");
  check(same(config->lpServiceStartName, std::wstring(L"NT SERVICE\\") + SERVICE));
  stage("LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SCM_SID_INFO_REJECTED");
  SERVICE_SID_INFO sid{}; api(QueryServiceConfig2W(service.value, SERVICE_CONFIG_SERVICE_SID_INFO, reinterpret_cast<BYTE*>(&sid), sizeof(sid), &needed) != FALSE);
  stage("LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SCM_SID_TYPE_REJECTED");
  check(sid.dwServiceSidType == SERVICE_SID_TYPE_UNRESTRICTED);
  stage("LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SCM_PROCESS_OPEN_REJECTED");
  Handle process(OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, status.dwProcessId)); api(static_cast<bool>(process));
  stage("LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SCM_PROCESS_IMAGE_REJECTED");
  check(same(processImage(process.value, error), image));
  return status.dwProcessId;
}
DWORD parentPid() {
  Handle snapshot(CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)); check(static_cast<bool>(snapshot));
  PROCESSENTRY32W entry{}; entry.dwSize = sizeof(entry); check(Process32FirstW(snapshot.value, &entry) != FALSE);
  do { if (entry.th32ProcessID == GetCurrentProcessId()) return entry.th32ParentProcessID; } while (Process32NextW(snapshot.value, &entry)); fail();
}
void verifyServiceProcess(const char** diagnostic = nullptr, DWORD* error = nullptr) {
  if (error) *error = 0;
  if (diagnostic) *diagnostic = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_TOKEN_QUERY_REJECTED";
  auto token = processToken();
  if (diagnostic) *diagnostic = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SERVICE_SID_REJECTED";
  check(tokenUser(token.value) == SERVICE_SID);
  if (diagnostic) *diagnostic = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_PARENT_QUERY_REJECTED";
  const DWORD parent = parentPid();
  if (diagnostic) *diagnostic = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_SERVICE_BINDING_REJECTED";
  const DWORD registered = servicePid(true, diagnostic, error);
  if (diagnostic) *diagnostic = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_PARENT_BINDING_REJECTED";
  check(parent == registered);
  if (diagnostic) *diagnostic = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_WORKER_KNOWN_FOLDER_REJECTED";
  const auto bin = fixedRoot(error) + L"\\bin\\";
  if (diagnostic) *diagnostic = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_WORKER_IMAGE_REJECTED";
  check(same(processImage(GetCurrentProcess(), error), bin + L"node.exe"));
  if (diagnostic) *diagnostic = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_RUNTIME_FILES_REJECTED";
  verifyProtectedBinary(bin + L"authority-broker-host.exe"); verifyProtectedBinary(bin + L"node.exe");
  verifyProtectedBinary(bin + L"authority-worker.mjs"); verifyProtectedBinary(bin + L"local-client-authority.node");
}
std::string privateBytes(const std::wstring& path, size_t maximum) {
  auto parents = pinParents(path, nullptr); auto file = openFile(path);
  check(acl(file.value, SE_FILE_OBJECT, nullptr, false, FILE_WRITES | FILE_GENERIC_READ | FILE_EXECUTE).strict);
  const auto root = fixedRoot();
  for (auto& handle : parents.handles) if (finalPath(handle.value).size() >= root.size()) check(acl(handle.value, SE_FILE_OBJECT, nullptr, false, FILE_WRITES).strict);
  return readBytes(file.value, maximum);
}

class Authority {
 public:
  std::wstring configuredCaller, configuredHost;
  std::string configuredPopInstance;
  bool initialized = false;
  ~Authority() { stop(); }
  void start() {
    if (worker.joinable()) return;
    worker = std::thread([this] {
      for (;;) {
        std::function<void()> work;
        { std::unique_lock<std::mutex> lock(queueMutex); wake.wait(lock, [&] { return stopping || !queue.empty(); });
          if (queue.empty() && stopping) break; work = std::move(queue.front()); queue.pop_front(); }
        work();
      }
      if (mutexOwned) { ReleaseMutex(globalMutex.value); mutexOwned = false; }
      contexts.clear(); globalMutex.reset();
    });
  }
  void stop() {
    { std::lock_guard<std::mutex> lock(queueMutex); stopping = true; } wake.notify_all();
    if (worker.joinable()) worker.join();
  }
  template<typename F> auto call(F work) -> decltype(work()) {
    check(initialized && worker.joinable());
    auto task = std::make_shared<std::packaged_task<decltype(work())()>>(std::move(work)); auto result = task->get_future();
    { std::lock_guard<std::mutex> lock(queueMutex); check(!stopping); queue.push_back([task] { (*task)(); }); }
    wake.notify_one(); return result.get();
  }
  std::string begin(HANDLE incoming) {
    return call([this, incoming] {
      check(contexts.empty());
      DWORD size = 0; TOKEN_TYPE kind{};
      // Do not close arbitrary non-token handles supplied by malformed input.
      check(GetTokenInformation(incoming, TokenType, &kind, sizeof(kind), &size) != FALSE); Handle token(incoming);
      check(kind == TokenImpersonation);
      SECURITY_IMPERSONATION_LEVEL level{};
      check(GetTokenInformation(incoming, TokenImpersonationLevel, &level, sizeof(level), &size) != FALSE && level >= SecurityImpersonation);
      check(tokenUser(incoming) == configuredCaller);
      std::string id = randomId(); contexts.emplace(id, std::move(token)); return id;
    });
  }
  std::string acquire(const std::string& context) {
    return call([this, context] {
      check(contexts.count(context) == 1 && !mutexOwned);
      LocalMemory security; std::wstring sddl = L"O:" + std::wstring(SERVICE_SID) + L"D:P(A;;GA;;;SY)(A;;GA;;;BA)(A;;GA;;;" + std::wstring(SERVICE_SID) + L")";
      check(ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl.c_str(), SDDL_REVISION_1, &security.value, nullptr) != FALSE);
      SECURITY_ATTRIBUTES attributes{sizeof(attributes), security.value, FALSE};
      globalMutex = Handle(CreateMutexExW(&attributes, MUTEX, 0, SYNCHRONIZE | MUTEX_MODIFY_STATE | READ_CONTROL)); check(static_cast<bool>(globalMutex));
      auto facts = acl(globalMutex.value, SE_KERNEL_OBJECT, nullptr, false, MUTEX_MODIFY_STATE | WRITE_DAC | WRITE_OWNER);
      check(facts.strict);
      DWORD result = WaitForSingleObject(globalMutex.value, 2000);
      if (result == WAIT_ABANDONED) { ReleaseMutex(globalMutex.value); fail(); }
      check(result == WAIT_OBJECT_0); mutexOwned = true; contextOwner = context; activeLease = randomId(); expires = Clock::now() + std::chrono::seconds(10); return activeLease;
    });
  }
  void release(const std::string& lease) {
    call([this, lease] { check(mutexOwned && lease == activeLease); releaseOwned(); });
  }
  void end(const std::string& context) {
    call([this, context] { check(contexts.count(context) == 1); if (mutexOwned && contextOwner == context) releaseOwned(); contexts.erase(context); });
  }
  template<typename F> auto locked(const std::string& lease, F work) -> decltype(work(static_cast<HANDLE>(nullptr))) {
    return call([this, lease, work] {
      // Expiry withdraws write authority, but never releases a competing writer early.
      check(mutexOwned && lease == activeLease && Clock::now() < expires && contexts.count(contextOwner) == 1);
      return work(contexts.at(contextOwner).value);
    });
  }
  void requireContext(const std::string& context) { check(contextOwner == context); }
 private:
  std::thread worker; std::mutex queueMutex; std::condition_variable wake; std::deque<std::function<void()>> queue;
  bool stopping = false, mutexOwned = false; Handle globalMutex;
  std::map<std::string, Handle> contexts; std::string activeLease, contextOwner; Clock::time_point expires;
  void releaseOwned() { check(ReleaseMutex(globalMutex.value) != FALSE); mutexOwned = false; activeLease.clear(); contextOwner.clear(); globalMutex.reset(); }
};

std::string claimNonce(HANDLE caller, const std::string& nonce) {
  check(nonce.size() == 64 && std::all_of(nonce.begin(), nonce.end(), [](char c) { return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'); }));
  const auto path = fixedRoot() + L"\\request-nonces.bin"; auto parents = pinParents(path, caller); check(!parents.callerCanReplaceAncestor);
  auto file = openFile(path, FILE_READ_DATA | FILE_APPEND_DATA | FILE_READ_ATTRIBUTES | READ_CONTROL);
  auto facts = acl(file.value, SE_FILE_OBJECT, caller, false, FILE_WRITES); check(facts.strict && !facts.callerWritable && facts.writers.count(SERVICE_SID) == 1);
  const std::string header(NONCE_HEADER); const std::string data = readBytes(file.value, header.size() + NONCE_CAPACITY * 65);
  check(data.rfind(header, 0) == 0 && (data.size() - header.size()) % 65 == 0);
  std::set<std::string> records;
  for (size_t offset = header.size(); offset < data.size(); offset += 65) {
    const std::string record = data.substr(offset, 64);
    check(data[offset + 64] == '\n' && std::all_of(record.begin(), record.end(), [](char c) { return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'); }));
    check(records.insert(record).second);
  }
  if (records.count(nonce) == 1) return "replayed";
  check(records.size() < NONCE_CAPACITY); const std::string entry = nonce + "\n"; DWORD written = 0;
  check(WriteFile(file.value, entry.data(), static_cast<DWORD>(entry.size()), &written, nullptr) != FALSE && written == entry.size());
  check(FlushFileBuffers(file.value) != FALSE); return "claimed";
}

// The complete PoP time floor and claims are one authenticated, atomic object.
// Never recycle the timeless legacy ledger or create this file during startup.
constexpr char POP_HEADER[] = "UAI-POP-REQUEST-REPLAY-V1\n";
constexpr size_t POP_LEDGER_MAX = 1024 * 1024, POP_CAPACITY = 4096;
constexpr uint64_t SAFE_INTEGER = 9007199254740991ULL, POP_TTL_MS = 8000;
struct PopRecord { std::string nonce, digest; uint64_t expires; };
struct PopLedger { std::string host, instance; uint64_t highWater = 0; std::vector<PopRecord> records; };
struct PopRequest { std::string nonce, digest, instance; uint64_t issued, expires; };
bool hex64(const std::string& value) {
  return value.size() == 64 && std::all_of(value.begin(), value.end(), [](char c) { return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'); });
}
void appendInteger(std::string& value, uint64_t number, size_t bytes) {
  for (size_t i = 0; i < bytes; ++i) value.push_back(static_cast<char>(number >> (i * 8)));
}
uint64_t takeInteger(const std::string& value, size_t& offset, size_t bytes) {
  check(offset <= value.size() && bytes <= value.size() - offset); uint64_t result = 0;
  for (size_t i = 0; i < bytes; ++i) result |= static_cast<uint64_t>(static_cast<unsigned char>(value[offset++])) << (i * 8);
  return result;
}
std::string encodePopLedger(const PopLedger& ledger) {
  check(ledger.host.size() >= 1 && ledger.host.size() <= 128 && hex64(ledger.instance) && ledger.highWater <= SAFE_INTEGER && ledger.records.size() <= POP_CAPACITY);
  std::string out(POP_HEADER); appendInteger(out, ledger.host.size(), 4); out += ledger.host; out += ledger.instance;
  appendInteger(out, ledger.highWater, 8); appendInteger(out, ledger.records.size(), 4); std::set<std::string> seen;
  for (const auto& record : ledger.records) {
    check(hex64(record.nonce) && hex64(record.digest) && record.expires > ledger.highWater && record.expires <= SAFE_INTEGER && seen.insert(record.nonce).second);
    out += record.nonce; out += record.digest; appendInteger(out, record.expires, 8);
  }
  check(out.size() <= POP_LEDGER_MAX); return out;
}
PopLedger decodePopLedger(const std::string& value) {
  const std::string header(POP_HEADER); check(value.size() <= POP_LEDGER_MAX && value.rfind(header, 0) == 0); size_t offset = header.size();
  const auto hostBytes = takeInteger(value, offset, 4); check(hostBytes >= 1 && hostBytes <= 128 && hostBytes <= value.size() - offset);
  PopLedger ledger; ledger.host = value.substr(offset, static_cast<size_t>(hostBytes)); offset += static_cast<size_t>(hostBytes);
  check(value.size() - offset >= 64); ledger.instance = value.substr(offset, 64); offset += 64;
  ledger.highWater = takeInteger(value, offset, 8); const auto count = takeInteger(value, offset, 4);
  check(count <= POP_CAPACITY && value.size() - offset == count * 136);
  for (uint64_t i = 0; i < count; ++i) {
    PopRecord record{value.substr(offset, 64), value.substr(offset + 64, 64), 0}; offset += 128;
    record.expires = takeInteger(value, offset, 8); ledger.records.push_back(std::move(record));
  }
  check(encodePopLedger(ledger) == value); return ledger;
}
uint64_t utcMilliseconds() {
  FILETIME value{}; GetSystemTimePreciseAsFileTime(&value);
  const uint64_t ticks = (static_cast<uint64_t>(value.dwHighDateTime) << 32) | value.dwLowDateTime;
  constexpr uint64_t unixEpoch = 116444736000000000ULL; check(ticks >= unixEpoch);
  const uint64_t now = (ticks - unixEpoch) / 10000; check(now <= SAFE_INTEGER); return now;
}
PopLedger readPopLedger(HANDLE caller) {
  const auto path = fixedRoot() + L"\\pop-request-replay.dpapi"; auto parents = pinParents(path, caller); check(!parents.callerCanReplaceAncestor);
  auto file = openFile(path); const auto facts = acl(file.value, SE_FILE_OBJECT, caller, false, FILE_WRITES | FILE_GENERIC_READ | FILE_EXECUTE);
  check(facts.strict && facts.writers.count(SERVICE_SID) == 1 && !facts.callerWritable);
  std::string encrypted = readBytes(file.value, POP_LEDGER_MAX); DATA_BLOB input{static_cast<DWORD>(encrypted.size()), reinterpret_cast<BYTE*>(encrypted.data())}, output{};
  check(CryptUnprotectData(&input, nullptr, nullptr, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &output) != FALSE); LocalMemory plain{output.pbData};
  std::string decoded(reinterpret_cast<char*>(output.pbData), output.cbData); SecureZeroMemory(output.pbData, output.cbData);
  try { auto ledger = decodePopLedger(decoded); SecureZeroMemory(decoded.data(), decoded.size()); return ledger; }
  catch (...) { SecureZeroMemory(decoded.data(), decoded.size()); throw; }
}
void writePopLedger(HANDLE caller, const PopLedger& ledger) {
  std::string plaintext = encodePopLedger(ledger); DATA_BLOB input{static_cast<DWORD>(plaintext.size()), reinterpret_cast<BYTE*>(plaintext.data())}, output{};
  const BOOL protectedOk = CryptProtectData(&input, L"Unified AI PoP request replay", nullptr, nullptr, nullptr,
    CRYPTPROTECT_LOCAL_MACHINE | CRYPTPROTECT_UI_FORBIDDEN, &output); SecureZeroMemory(plaintext.data(), plaintext.size()); check(protectedOk != FALSE);
  LocalMemory encrypted{output.pbData}; check(output.cbData > 0 && output.cbData <= POP_LEDGER_MAX);
  const auto path = fixedRoot() + L"\\pop-request-replay.dpapi", temporary = fixedRoot() + L"\\pop-request-replay.tmp-" + wide(randomId());
  auto parents = pinParents(path, caller); check(!parents.callerCanReplaceAncestor); auto existing = openFile(path);
  auto oldFacts = acl(existing.value, SE_FILE_OBJECT, caller, false, FILE_WRITES | FILE_GENERIC_READ | FILE_EXECUTE);
  check(oldFacts.strict && !oldFacts.callerWritable && oldFacts.writers.count(SERVICE_SID) == 1);
  LocalMemory security; const auto sddl = L"O:" + std::wstring(SERVICE_SID) + L"D:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;FA;;;" + std::wstring(SERVICE_SID) + L")";
  check(ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl.c_str(), SDDL_REVISION_1, &security.value, nullptr) != FALSE);
  SECURITY_ATTRIBUTES attributes{sizeof(attributes), security.value, FALSE}; bool temporaryOwned = false;
  try {
    Handle file(CreateFileW(temporary.c_str(), GENERIC_WRITE | READ_CONTROL | FILE_READ_ATTRIBUTES, FILE_SHARE_READ, &attributes, CREATE_NEW,
      FILE_ATTRIBUTE_NORMAL | FILE_FLAG_WRITE_THROUGH | FILE_FLAG_OPEN_REPARSE_POINT, nullptr)); check(static_cast<bool>(file)); temporaryOwned = true;
    validateHandle(file.value, temporary, false); DWORD written = 0;
    check(WriteFile(file.value, output.pbData, output.cbData, &written, nullptr) != FALSE && written == output.cbData && FlushFileBuffers(file.value) != FALSE);
    file.reset(); existing.reset(); check(MoveFileExW(temporary.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH) != FALSE); temporaryOwned = false;
    auto committed = openFile(path, GENERIC_READ | GENERIC_WRITE | READ_CONTROL | FILE_READ_ATTRIBUTES);
    check(FlushFileBuffers(committed.value) != FALSE); committed.reset();
    check(encodePopLedger(readPopLedger(caller)) == encodePopLedger(ledger));
  } catch (...) { if (temporaryOwned) DeleteFileW(temporary.c_str()); throw; }
}
void advancePopTime(PopLedger& ledger, uint64_t now) {
  check(now >= ledger.highWater && now <= SAFE_INTEGER); ledger.highWater = now;
  ledger.records.erase(std::remove_if(ledger.records.begin(), ledger.records.end(), [now](const PopRecord& value) { return value.expires <= now; }), ledger.records.end());
}
// This pure transition is also exercised by the isolated native model harness.
std::string applyPopClaim(PopLedger& ledger, const PopRequest& request, uint64_t now, bool freshOnly) {
  check(hex64(request.nonce) && hex64(request.digest) && request.instance == ledger.instance && hex64(request.instance)
    && request.issued < request.expires && request.expires <= SAFE_INTEGER && request.expires - request.issued <= POP_TTL_MS);
  advancePopTime(ledger, now);
  if (request.issued > now) return "future";
  if (request.expires <= now) return "expired";
  const auto found = std::find_if(ledger.records.begin(), ledger.records.end(), [&](const PopRecord& item) { return item.nonce == request.nonce; });
  if (freshOnly) {
    check(found != ledger.records.end() && found->digest == request.digest && found->expires == request.expires); return "fresh";
  }
  if (found != ledger.records.end()) return "replayed";
  if (ledger.records.size() == POP_CAPACITY) return "capacity";
  ledger.records.push_back({request.nonce, request.digest, request.expires}); return "claimed";
}
std::pair<std::string, uint64_t> claimPop(HANDLE caller, const std::string& host, const std::string& active,
  const PopRequest& request, bool freshOnly) {
  check(hex64(active) && request.instance == active); auto ledger = readPopLedger(caller); check(ledger.host == host && ledger.instance == active);
  const auto before = encodePopLedger(ledger); const auto now = utcMilliseconds(); const auto result = applyPopClaim(ledger, request, now, freshOnly);
  // Even definitive expired/replayed/capacity responses first commit time and GC.
  if (encodePopLedger(ledger) != before) writePopLedger(caller, ledger);
  return {result, now};
}
std::string startPopInstance(const std::string& host) {
  verifyServiceProcess(); ServiceHandle manager{OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CONNECT)}; check(manager.value != nullptr);
  ServiceHandle service{OpenServiceW(manager.value, SERVICE, SERVICE_QUERY_STATUS)}; check(service.value != nullptr); SERVICE_STATUS_PROCESS status{}; DWORD needed = 0;
  check(QueryServiceStatusEx(service.value, SC_STATUS_PROCESS_INFO, reinterpret_cast<BYTE*>(&status), sizeof(status), &needed) != FALSE
    && status.dwCurrentState == SERVICE_START_PENDING && status.dwProcessId == parentPid());
  // Initialization is callable only by the fixed host's startup child, never by a pipe worker while RUNNING.
  LocalMemory security; const auto sddl = L"O:" + std::wstring(SERVICE_SID) + L"D:P(A;;GA;;;SY)(A;;GA;;;BA)(A;;GA;;;" + std::wstring(SERVICE_SID) + L")";
  check(ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl.c_str(), SDDL_REVISION_1, &security.value, nullptr) != FALSE);
  SECURITY_ATTRIBUTES attributes{sizeof(attributes), security.value, FALSE}; Handle mutex(CreateMutexExW(&attributes, MUTEX, 0, SYNCHRONIZE | MUTEX_MODIFY_STATE | READ_CONTROL)); check(static_cast<bool>(mutex));
  check(acl(mutex.value, SE_KERNEL_OBJECT, nullptr, false, MUTEX_MODIFY_STATE | WRITE_DAC | WRITE_OWNER).strict);
  const auto acquired = WaitForSingleObject(mutex.value, 2000); if (acquired == WAIT_ABANDONED) { ReleaseMutex(mutex.value); fail(); } check(acquired == WAIT_OBJECT_0);
  try {
    auto ledger = readPopLedger(nullptr); check(ledger.host == host); advancePopTime(ledger, utcMilliseconds()); ledger.instance = randomId() + randomId();
    writePopLedger(nullptr, ledger); check(ReleaseMutex(mutex.value) != FALSE); return ledger.instance;
  } catch (...) { ReleaseMutex(mutex.value); throw; }
}
void writeCheckpoint(HANDLE caller, const Target& target, const std::string& json) {
  check(!json.empty() && json.size() <= MAX_BYTES); static_cast<void>(wide(json));
  auto secured = protection(target, caller); requireProtection(secured);
  const std::wstring temporary = target.root + L"\\authority.tmp-" + wide(randomId());
  LocalMemory security; const std::wstring sddl = L"O:" + std::wstring(SERVICE_SID) + L"D:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;FA;;;" + std::wstring(SERVICE_SID) + L")(A;;FR;;;" + tokenUser(caller) + L")";
  check(ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl.c_str(), SDDL_REVISION_1, &security.value, nullptr) != FALSE);
  SECURITY_ATTRIBUTES attributes{sizeof(attributes), security.value, FALSE}; bool temporaryOwned = false;
  try {
    Handle file(CreateFileW(temporary.c_str(), GENERIC_WRITE | READ_CONTROL | FILE_READ_ATTRIBUTES, FILE_SHARE_READ, &attributes, CREATE_NEW, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_WRITE_THROUGH | FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
    check(static_cast<bool>(file)); temporaryOwned = true; validateHandle(file.value, temporary, false);
    DWORD written = 0; check(WriteFile(file.value, json.data(), static_cast<DWORD>(json.size()), &written, nullptr) != FALSE && written == json.size());
    check(FlushFileBuffers(file.value) != FALSE); file.reset(); secured.file.reset();
    // All parents remain pinned; only trusted service/admin identities can alter this subtree.
    check(MoveFileExW(temporary.c_str(), target.file.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH) != FALSE); temporaryOwned = false;
    auto committed = openFile(target.file, GENERIC_READ | GENERIC_WRITE | READ_CONTROL | FILE_READ_ATTRIBUTES);
    check(FlushFileBuffers(committed.value) != FALSE && readBytes(committed.value, MAX_BYTES) == json);
    auto facts = acl(committed.value, SE_FILE_OBJECT, caller, false, FILE_WRITES); check(facts.strict && !facts.callerWritable);
  } catch (...) { if (temporaryOwned) DeleteFileW(temporary.c_str()); throw; }
}
std::string readRegistry(const Target& target, HANDLE caller) {
  auto secured = protection(target, caller); requireProtection(secured);
  DWORD kind = 0, size = 0; check(RegQueryValueExW(secured.registry.target.value, L"Checkpoint", nullptr, &kind, nullptr, &size) == ERROR_SUCCESS);
  check(kind == REG_SZ && size >= sizeof(wchar_t) && size <= (MAX_BYTES + 1) * sizeof(wchar_t) && size % sizeof(wchar_t) == 0);
  std::vector<wchar_t> data(size / sizeof(wchar_t)); DWORD actual = size;
  check(RegQueryValueExW(secured.registry.target.value, L"Checkpoint", nullptr, &kind, reinterpret_cast<BYTE*>(data.data()), &actual) == ERROR_SUCCESS && actual == size && kind == REG_SZ && data.back() == L'\0');
  check(std::find(data.begin(), data.end() - 1, L'\0') == data.end() - 1);
  auto result = utf8(std::wstring(data.data(), data.size() - 1)); check(result.size() <= MAX_BYTES); return result;
}
void writeRegistry(const Target& target, HANDLE caller, const std::string& json) {
  check(!json.empty() && json.size() <= MAX_BYTES); auto text = wide(json); auto secured = protection(target, caller, true); requireProtection(secured);
  check(RegSetValueExW(secured.registry.target.value, L"Checkpoint", 0, REG_SZ, reinterpret_cast<const BYTE*>(text.c_str()), static_cast<DWORD>((text.size() + 1) * sizeof(wchar_t))) == ERROR_SUCCESS);
  check(RegFlushKey(secured.registry.target.value) == ERROR_SUCCESS);
}
void transfer(HANDLE pipe, BYTE* bytes, DWORD length, bool writing, Clock::time_point deadline) {
  DWORD total = 0;
  while (total < length) {
    check(Clock::now() < deadline); Handle event(CreateEventW(nullptr, TRUE, FALSE, nullptr)); check(static_cast<bool>(event)); OVERLAPPED operation{}; operation.hEvent = event.value;
    DWORD moved = 0; BOOL complete = writing ? WriteFile(pipe, bytes + total, length - total, &moved, &operation) : ReadFile(pipe, bytes + total, length - total, &moved, &operation);
    if (!complete) {
      check(GetLastError() == ERROR_IO_PENDING);
      auto left = std::chrono::duration_cast<std::chrono::milliseconds>(deadline - Clock::now()).count();
      DWORD wait = left > 0 ? WaitForSingleObject(event.value, static_cast<DWORD>(left)) : WAIT_TIMEOUT;
      if (wait != WAIT_OBJECT_0) { CancelIoEx(pipe, &operation); WaitForSingleObject(event.value, INFINITE); fail(); }
      check(GetOverlappedResult(pipe, &operation, &moved, FALSE) != FALSE);
    }
    check(moved > 0 && moved <= length - total); total += moved;
  }
}
std::string clientRequest(const std::string& payload) {
  check(!payload.empty() && payload.size() <= MAX_BYTES); static_cast<void>(wide(payload));
  auto caller = callerSelfToken(); const DWORD expectedPid = servicePid(); const auto bin = fixedRoot() + L"\\bin\\";
  // Hold the process object through the exchange, preventing PID-reuse aliases.
  Handle serverProcess(OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, expectedPid)); check(static_cast<bool>(serverProcess));
  check(same(processImage(serverProcess.value), bin + L"authority-broker-host.exe"));
  verifyProtectedBinary(bin + L"authority-broker-host.exe", caller.value); verifyProtectedBinary(bin + L"node.exe", caller.value);
  verifyProtectedBinary(bin + L"authority-worker.mjs", caller.value); verifyProtectedBinary(bin + L"local-client-authority.node", caller.value);
  check(WaitNamedPipeW(PIPE, 2000) != FALSE);
  Handle pipe(CreateFileW(PIPE, GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, FILE_FLAG_OVERLAPPED | SECURITY_SQOS_PRESENT | SECURITY_IMPERSONATION, nullptr)); check(static_cast<bool>(pipe));
  ULONG actualPid = 0; check(GetNamedPipeServerProcessId(pipe.value, &actualPid) != FALSE && actualPid == expectedPid && servicePid() == expectedPid);
  const auto deadline = Clock::now() + std::chrono::seconds(8); DWORD length = static_cast<DWORD>(payload.size()); BYTE prefix[4];
  for (unsigned i = 0; i < 4; ++i) prefix[i] = static_cast<BYTE>((length >> (8 * i)) & 255);
  transfer(pipe.value, prefix, sizeof(prefix), true, deadline);
  transfer(pipe.value, reinterpret_cast<BYTE*>(const_cast<char*>(payload.data())), length, true, deadline);
  transfer(pipe.value, prefix, sizeof(prefix), false, deadline); length = 0;
  for (unsigned i = 0; i < 4; ++i) length |= static_cast<DWORD>(prefix[i]) << (8 * i);
  check(length > 0 && length <= MAX_BYTES); std::string response(length, '\0');
  transfer(pipe.value, reinterpret_cast<BYTE*>(response.data()), length, false, deadline); static_cast<void>(wide(response));
  check(GetNamedPipeServerProcessId(pipe.value, &actualPid) != FALSE && actualPid == expectedPid && servicePid() == expectedPid); return response;
}

// N-API values stay on the JS thread. Only copied, bounded data crosses native workers.
void napiCheck(napi_status status) { check(status == napi_ok); }
std::string stringValue(napi_env env, napi_value value, size_t maximum = MAX_BYTES) {
  napi_valuetype type; napiCheck(napi_typeof(env, value, &type)); check(type == napi_string); size_t size = 0;
  napiCheck(napi_get_value_string_utf8(env, value, nullptr, 0, &size)); check(size <= maximum);
  std::vector<char> bytes(size + 1); size_t actual = 0; napiCheck(napi_get_value_string_utf8(env, value, bytes.data(), bytes.size(), &actual)); check(actual == size);
  std::string result(bytes.data(), actual); static_cast<void>(wide(result)); return result;
}
napi_value jsString(napi_env env, const std::string& text) { napi_value value; napiCheck(napi_create_string_utf8(env, text.data(), text.size(), &value)); return value; }
napi_value jsObject(napi_env env) { napi_value value; napiCheck(napi_create_object(env, &value)); return value; }
uint64_t safeIntegerValue(napi_env env, napi_value value) {
  napi_valuetype type; napiCheck(napi_typeof(env, value, &type)); check(type == napi_number); double number = 0;
  napiCheck(napi_get_value_double(env, value, &number)); check(std::isfinite(number) && number >= 0 && number <= static_cast<double>(SAFE_INTEGER) && std::floor(number) == number);
  return static_cast<uint64_t>(number);
}
void put(napi_env env, napi_value object, const char* key, napi_value value) { napiCheck(napi_set_named_property(env, object, key, value)); }
void putString(napi_env env, napi_value object, const char* key, const std::string& value) { put(env, object, key, jsString(env, value)); }
void putBool(napi_env env, napi_value object, const char* key, bool value) { napi_value item; napiCheck(napi_get_boolean(env, value, &item)); put(env, object, key, item); }
void putInteger(napi_env env, napi_value object, const char* key, uint64_t value) { check(value <= SAFE_INTEGER); napi_value item; napiCheck(napi_create_double(env, static_cast<double>(value), &item)); put(env, object, key, item); }
napi_value property(napi_env env, napi_value object, const char* key) { napi_value value; napiCheck(napi_get_named_property(env, object, key, &value)); return value; }
void exactKeys(napi_env env, napi_value object, std::initializer_list<const char*> expected) {
  napi_valuetype type; napiCheck(napi_typeof(env, object, &type)); check(type == napi_object); bool array = false; napiCheck(napi_is_array(env, object, &array)); check(!array);
  napi_value keys; napiCheck(napi_get_property_names(env, object, &keys)); uint32_t length = 0; napiCheck(napi_get_array_length(env, keys, &length)); check(length == expected.size());
  for (const char* name : expected) { bool present = false; napiCheck(napi_has_own_property(env, object, jsString(env, name), &present)); check(present); }
}
std::vector<napi_value> arguments(napi_env env, napi_callback_info info, size_t count) {
  std::vector<napi_value> args(count + 1); size_t actual = args.size(); napiCheck(napi_get_cb_info(env, info, &actual, args.data(), nullptr, nullptr)); check(actual == count); args.resize(count); return args;
}
Target targetValue(napi_env env, napi_value value) {
  exactKeys(env, value, {"serviceName", "serviceSid", "programDataBasePath", "programDataRoot", "anchorPath", "hklmKeyPath", "hklmView"});
  auto field = [&](const char* key) { return wide(stringValue(env, property(env, value, key), 32700)); };
  check(field("serviceName") == SERVICE && field("serviceSid") == SERVICE_SID && field("hklmView") == L"registry64" && same(field("programDataBasePath"), programData()));
  Target result{field("programDataRoot"), field("anchorPath"), REGISTRY}; const auto root = fixedRoot();
  if (!same(result.root, root)) {
    const auto prefix = root + L"\\anchors\\"; check(result.root.size() > prefix.size() && same(result.root.substr(0, prefix.size()), prefix));
    const auto slot = result.root.substr(prefix.size()); check(slot.size() <= 64 && slot.front() >= L'a' && slot.front() <= L'z');
    check(std::all_of(slot.begin(), slot.end(), [](wchar_t c) { return (c >= L'a' && c <= L'z') || (c >= L'0' && c <= L'9') || c == L'-'; }));
    check(slot != L"con" && slot != L"prn" && slot != L"aux" && slot != L"nul");
    check(!(slot.size() == 4 && (slot.substr(0, 3) == L"com" || slot.substr(0, 3) == L"lpt") && slot.back() >= L'1' && slot.back() <= L'9'));
    result.registry += L"\\Anchors\\" + slot;
  }
  check(same(result.file, result.root + L"\\authority.json") && same(field("hklmKeyPath"), registryDisplay(result))); return result;
}
std::shared_ptr<Authority> state(napi_env env) { void* value = nullptr; napiCheck(napi_get_instance_data(env, &value)); check(value != nullptr); return *static_cast<std::shared_ptr<Authority>*>(value); }
napi_value undefined(napi_env env) { napi_value value; napiCheck(napi_get_undefined(env, &value)); return value; }
template<typename F> napi_value guarded(napi_env env, F work) {
  try { return work(); }
  catch (const std::exception& error) {
    const std::string code(error.what());
    if (code == "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_REQUEST_EXPIRED" || code == "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_REQUEST_FUTURE")
      napi_throw_error(env, code.c_str(), "The request lifetime ended; an earlier mutation may already have committed.");
    else napi_throw_error(env, "LOCAL_CLIENT_WINDOWS_NATIVE_REJECTED", "Windows authority operation rejected.");
    return nullptr;
  } catch (...) { napi_throw_error(env, "LOCAL_CLIENT_WINDOWS_NATIVE_REJECTED", "Windows authority operation rejected."); return nullptr; }
}
struct AsyncCall { napi_env env; napi_async_work work = nullptr; napi_deferred deferred; std::function<std::string()> operation; std::string result; bool ok = false; };
napi_value asynchronous(napi_env env, std::function<std::string()> operation) {
  auto call = std::make_unique<AsyncCall>(); call->env = env; call->operation = std::move(operation); napi_value promise;
  napiCheck(napi_create_promise(env, &call->deferred, &promise));
  napiCheck(napi_create_async_work(env, nullptr, jsString(env, "WindowsAuthorityOperation"),
    [](napi_env, void* raw) { auto item = static_cast<AsyncCall*>(raw); try { item->result = item->operation(); item->ok = true; } catch (...) {} },
    [](napi_env environment, napi_status status, void* raw) {
      std::unique_ptr<AsyncCall> item(static_cast<AsyncCall*>(raw));
      if (status == napi_ok && item->ok) napi_resolve_deferred(environment, item->deferred, jsString(environment, item->result));
      else { napi_value error; napi_create_error(environment, jsString(environment, "LOCAL_CLIENT_WINDOWS_NATIVE_REJECTED"), jsString(environment, "Windows authority operation rejected."), &error); napi_reject_deferred(environment, item->deferred, error); }
      napi_delete_async_work(environment, item->work);
    }, call.get(), &call->work));
  napiCheck(napi_queue_async_work(env, call->work)); call.release(); return promise;
}
napi_value inspectEnvironment(napi_env env, napi_callback_info info) {
  const char* phase = "Environment arguments rejected.";
  try {
    arguments(env, info, 0); phase = "Environment token query unavailable."; auto token = processToken();
    phase = "Environment elevation unavailable."; auto elevated = tokenInfo(token.value, TokenElevation);
    phase = "Environment elevation type unavailable."; auto type = tokenInfo(token.value, TokenElevationType);
    phase = "Environment group query unavailable."; auto groups = tokenInfo(token.value, TokenGroups);
    bool adminEnabled = false, adminDenyOnly = false; auto entries = reinterpret_cast<TOKEN_GROUPS*>(groups.data());
    phase = "Environment group conversion unavailable.";
    for (DWORD i = 0; i < entries->GroupCount; ++i) if (sidText(entries->Groups[i].Sid) == L"S-1-5-32-544") {
      adminEnabled = (entries->Groups[i].Attributes & SE_GROUP_ENABLED) != 0; adminDenyOnly = (entries->Groups[i].Attributes & SE_GROUP_USE_FOR_DENY_ONLY) != 0;
    }
    phase = "Environment known folder unavailable."; auto base = utf8(programData());
    phase = "Environment output unavailable."; auto result = jsObject(env); putString(env, result, "osPlatform", "win32"); putString(env, result, "programDataBasePath", base);
    putBool(env, result, "tokenElevated", reinterpret_cast<TOKEN_ELEVATION*>(elevated.data())->TokenIsElevated != 0);
    putBool(env, result, "elevationTypeLimited", *reinterpret_cast<TOKEN_ELEVATION_TYPE*>(type.data()) == TokenElevationTypeLimited);
    putBool(env, result, "administratorsEnabled", adminEnabled); putBool(env, result, "administratorsDenyOnly", adminDenyOnly);
    putBool(env, result, "runningAsServiceSid", tokenUser(token.value) == SERVICE_SID); return result;
  } catch (...) { napi_throw_error(env, "LOCAL_CLIENT_WINDOWS_NATIVE_REJECTED", phase); return nullptr; }
}
napi_value initializeService(napi_env env, napi_callback_info info) {
  return guarded(env, [&] {
    auto args = arguments(env, info, 1); bool hasPop = false; napiCheck(napi_has_own_property(env, args[0], jsString(env, "serviceInstanceId"), &hasPop));
    if (hasPop) exactKeys(env, args[0], {"hostId", "currentUserSid", "serviceInstanceId"}); else exactKeys(env, args[0], {"hostId", "currentUserSid"});
    const auto pop = hasPop ? stringValue(env, property(env, args[0], "serviceInstanceId"), 64) : std::string(); check(!hasPop || hex64(pop));
    auto instance = state(env); verifyServiceProcess();
    auto host = stringValue(env, property(env, args[0], "hostId"), 128); check(!host.empty() && std::all_of(host.begin(), host.end(), [](char c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '.' || c == '-' || c == '_'; }));
    auto caller = wide(stringValue(env, property(env, args[0], "currentUserSid"), 184)); LocalMemory sid; check(ConvertStringSidToSidW(caller.c_str(), &sid.value) != FALSE && sidText(sid.value) == caller && !privilegedSid(caller));
    if (instance->initialized) check(instance->configuredHost == wide(host) && instance->configuredCaller == caller && instance->configuredPopInstance == pop);
    else { instance->configuredHost = wide(host); instance->configuredCaller = caller; instance->configuredPopInstance = pop; instance->initialized = true; instance->start(); }
    auto result = jsObject(env); putString(env, result, "osPlatform", "win32"); putString(env, result, "hostId", host); putString(env, result, "serviceName", utf8(SERVICE)); putString(env, result, "serviceSid", utf8(SERVICE_SID));
    putString(env, result, "programDataBasePath", utf8(programData())); putString(env, result, "hklmView", "registry64"); putBool(env, result, "runningAsServiceSid", true); return result;
  });
}
napi_value beginRequest(napi_env env, napi_callback_info info) {
  return guarded(env, [&] {
    auto args = arguments(env, info, 1); auto raw = stringValue(env, args[0], 20); check(!raw.empty() && raw.front() != '0' && std::all_of(raw.begin(), raw.end(), [](char c) { return c >= '0' && c <= '9'; }));
    unsigned long long handle = std::stoull(raw); check(handle != 0 && handle <= UINTPTR_MAX); return jsString(env, state(env)->begin(reinterpret_cast<HANDLE>(static_cast<uintptr_t>(handle))));
  });
}
napi_value endRequest(napi_env env, napi_callback_info info) { return guarded(env, [&] { auto args = arguments(env, info, 1); state(env)->end(stringValue(env, args[0], 32)); return undefined(env); }); }
napi_value acquireLock(napi_env env, napi_callback_info info) {
  return guarded(env, [&] { auto args = arguments(env, info, 1); auto context = stringValue(env, args[0], 32); auto instance = state(env); return asynchronous(env, [instance, context] { return instance->acquire(context); }); });
}
napi_value releaseLock(napi_env env, napi_callback_info info) { return guarded(env, [&] { auto args = arguments(env, info, 1); state(env)->release(stringValue(env, args[0], 32)); return undefined(env); }); }
napi_value nonceClaim(napi_env env, napi_callback_info info) {
  return guarded(env, [&] { auto args = arguments(env, info, 2); auto lease = stringValue(env, args[0], 32), nonce = stringValue(env, args[1], 64);
    return jsString(env, state(env)->locked(lease, [nonce](HANDLE caller) { return claimNonce(caller, nonce); })); });
}
PopRequest popRequestValue(napi_env env, napi_value value, const std::shared_ptr<Authority>& instance) {
  exactKeys(env, value, {"hostId", "serviceSid", "nonce", "requestDigestSha256", "serviceInstanceId", "issuedAtMs", "expiresAtMs"});
  check(wide(stringValue(env, property(env, value, "hostId"), 128)) == instance->configuredHost
    && wide(stringValue(env, property(env, value, "serviceSid"), 184)) == SERVICE_SID);
  PopRequest request{stringValue(env, property(env, value, "nonce"), 64), stringValue(env, property(env, value, "requestDigestSha256"), 64),
    stringValue(env, property(env, value, "serviceInstanceId"), 64), safeIntegerValue(env, property(env, value, "issuedAtMs")), safeIntegerValue(env, property(env, value, "expiresAtMs"))};
  check(hex64(request.nonce) && hex64(request.digest) && hex64(request.instance) && request.instance == instance->configuredPopInstance
    && request.issued < request.expires && request.expires - request.issued <= POP_TTL_MS); return request;
}
napi_value startPopServiceInstance(napi_env env, napi_callback_info info) {
  return guarded(env, [&] { arguments(env, info, 0); auto instance = state(env); check(instance->initialized && instance->configuredPopInstance.empty());
    return jsString(env, startPopInstance(utf8(instance->configuredHost))); });
}
napi_value readPopServiceInstance(napi_env env, napi_callback_info info) {
  return guarded(env, [&] { auto args = arguments(env, info, 2); const auto lease = stringValue(env, args[0], 32), expected = stringValue(env, args[1], 64); auto instance = state(env);
    check(hex64(expected) && expected == instance->configuredPopInstance);
    const auto now = instance->locked(lease, [instance, expected](HANDLE caller) {
      auto ledger = readPopLedger(caller); check(ledger.host == utf8(instance->configuredHost) && ledger.instance == expected);
      const auto before = encodePopLedger(ledger); const auto observed = utcMilliseconds(); advancePopTime(ledger, observed);
      if (encodePopLedger(ledger) != before) writePopLedger(caller, ledger); return observed;
    }); auto result = jsObject(env); putString(env, result, "serviceInstanceId", expected); putInteger(env, result, "observedAtMs", now); return result;
  });
}
napi_value expiringNonce(napi_env env, napi_callback_info info, bool freshOnly) {
  return guarded(env, [&] { auto args = arguments(env, info, 2); const auto lease = stringValue(env, args[0], 32); auto instance = state(env); auto requestValue = popRequestValue(env, args[1], instance);
    const auto observed = instance->locked(lease, [instance, requestValue, freshOnly](HANDLE caller) {
      return claimPop(caller, utf8(instance->configuredHost), instance->configuredPopInstance, requestValue, freshOnly);
    });
    if (freshOnly && observed.first == "expired") throw std::runtime_error("LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_REQUEST_EXPIRED");
    if (freshOnly && observed.first == "future") throw std::runtime_error("LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_REQUEST_FUTURE");
    if (freshOnly) check(observed.first == "fresh"); auto result = jsObject(env);
    if (!freshOnly) putString(env, result, "result", observed.first); putInteger(env, result, "observedAtMs", observed.second); return result;
  });
}
napi_value claimExpiringNonce(napi_env env, napi_callback_info info) { return expiringNonce(env, info, false); }
napi_value assertExpiringRequestFresh(napi_env env, napi_callback_info info) { return expiringNonce(env, info, true); }
napi_value fileRead(napi_env env, napi_callback_info info) {
  return guarded(env, [&] { auto args = arguments(env, info, 2); auto lease = stringValue(env, args[0], 32); auto target = targetValue(env, args[1]);
    return jsString(env, state(env)->locked(lease, [target](HANDLE caller) { auto value = protection(target, caller); requireProtection(value); auto text = readBytes(value.file.value, MAX_BYTES); static_cast<void>(wide(text)); return text; })); });
}
napi_value fileWrite(napi_env env, napi_callback_info info) {
  return guarded(env, [&] { auto args = arguments(env, info, 3); auto lease = stringValue(env, args[0], 32); auto target = targetValue(env, args[1]); auto text = stringValue(env, args[2]);
    state(env)->locked(lease, [target, text](HANDLE caller) { writeCheckpoint(caller, target, text); }); return undefined(env); });
}
napi_value registryRead(napi_env env, napi_callback_info info) {
  return guarded(env, [&] { auto args = arguments(env, info, 2); auto lease = stringValue(env, args[0], 32); auto target = targetValue(env, args[1]);
    return jsString(env, state(env)->locked(lease, [target](HANDLE caller) { return readRegistry(target, caller); })); });
}
napi_value registryWrite(napi_env env, napi_callback_info info) {
  return guarded(env, [&] { auto args = arguments(env, info, 3); auto lease = stringValue(env, args[0], 32); auto target = targetValue(env, args[1]); auto text = stringValue(env, args[2]);
    state(env)->locked(lease, [target, text](HANDLE caller) { writeRegistry(target, caller, text); }); return undefined(env); });
}
napi_value sidArray(napi_env env, const std::set<std::wstring>& values) {
  napi_value array; napiCheck(napi_create_array_with_length(env, values.size(), &array)); uint32_t index = 0;
  for (const auto& value : values) napiCheck(napi_set_element(env, array, index++, jsString(env, utf8(value)))); return array;
}
napi_value inspectAclFacts(napi_env env, napi_callback_info info) {
  return guarded(env, [&] {
    auto args = arguments(env, info, 3); auto lease = stringValue(env, args[0], 32), context = stringValue(env, args[1], 32); auto target = targetValue(env, args[2]); auto instance = state(env);
    auto facts = instance->locked(lease, [instance, target, context](HANDLE caller) {
      instance->requireContext(context); auto secured = protection(target, caller);
      return std::vector<AclFacts>{secured.rootAcl, secured.fileAcl, secured.registryAcl};
    });
    auto result = jsObject(env); putString(env, result, "source", "independent-privileged-broker"); putString(env, result, "currentUserSid", utf8(instance->configuredCaller)); putString(env, result, "serviceSid", utf8(SERVICE_SID));
    const char* prefixes[] = {"root", "file", "registry"};
    for (size_t i = 0; i < facts.size(); ++i) { const std::string prefix(prefixes[i]);
      putString(env, result, (prefix + "OwnerSid").c_str(), utf8(facts[i].owner));
      put(env, result, (prefix + "AllowedWriteSids").c_str(), sidArray(env, facts[i].writers)); put(env, result, (prefix + "InheritedWriteSids").c_str(), sidArray(env, facts[i].inherited));
      putBool(env, result, (prefix + "CurrentUserCanWrite").c_str(), facts[i].callerWritable);
    }
    putString(env, result, "hklmHive", "HKLM"); putString(env, result, "hklmKeyPath", utf8(registryDisplay(target))); putString(env, result, "hklmView", "registry64"); return result;
  });
}
napi_value readBootstrap(napi_env env, napi_callback_info info) {
  const char* code = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_ARGUMENTS_REJECTED";
  DWORD error = 0;
  try {
    arguments(env, info, 0); code = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_IDENTITY_REJECTED"; verifyServiceProcess(&code, &error);
    code = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_CONFIG_REJECTED";
    const auto root = fixedRoot(); auto config = privateBytes(root + L"\\bootstrap.json", MAX_BYTES); static_cast<void>(wide(config));
    code = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_KEY_READ_REJECTED";
    std::string encrypted = privateBytes(root + L"\\integrity-key.dpapi", MAX_BYTES); DATA_BLOB input{static_cast<DWORD>(encrypted.size()), reinterpret_cast<BYTE*>(encrypted.data())}, output{};
    code = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_DECRYPT_REJECTED";
    check(CryptUnprotectData(&input, nullptr, nullptr, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &output) != FALSE);
    LocalMemory plaintext{output.pbData};
    try {
      code = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_KEY_LENGTH_REJECTED"; check(output.cbData == 32);
      code = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_EXPORT_REJECTED";
      auto result = jsObject(env); putString(env, result, "configJson", config); napi_value key;
      napiCheck(napi_create_buffer_copy(env, output.cbData, output.pbData, nullptr, &key)); put(env, result, "integrityKey", key); SecureZeroMemory(output.pbData, output.cbData); return result;
    } catch (...) { SecureZeroMemory(output.pbData, output.cbData); throw; }
  } catch (...) {
    std::string diagnostic = std::string(code) + "_E" + std::to_string(error);
    if (diagnostic.size() > 128) diagnostic = "LOCAL_CLIENT_WINDOWS_BOOTSTRAP_REJECTED_E0";
    napi_throw_error(env, diagnostic.c_str(), "Windows authority bootstrap rejected."); return nullptr;
  }
}
napi_value request(napi_env env, napi_callback_info info) {
  return guarded(env, [&] { auto args = arguments(env, info, 1); auto payload = stringValue(env, args[0]); return asynchronous(env, [payload] { return clientRequest(payload); }); });
}
napi_value Init(napi_env env, napi_value exports) {
  return guarded(env, [&] {
    auto instance = new std::shared_ptr<Authority>(std::make_shared<Authority>());
    napiCheck(napi_set_instance_data(env, instance, [](napi_env, void* value, void*) { delete static_cast<std::shared_ptr<Authority>*>(value); }, nullptr));
    struct Export { const char* name; napi_callback callback; };
    const Export functions[] = {{"inspectEnvironment", inspectEnvironment}, {"initializeService", initializeService}, {"beginRequest", beginRequest}, {"endRequest", endRequest},
      {"acquireLock", acquireLock}, {"releaseLock", releaseLock}, {"claimNonce", nonceClaim}, {"readProtectedFileCheckpoint", fileRead}, {"writeProtectedFileCheckpointAtomically", fileWrite},
      {"readHklmCheckpoint64", registryRead}, {"writeHklmCheckpoint64", registryWrite}, {"inspectAclFacts", inspectAclFacts}, {"readBootstrap", readBootstrap}, {"request", request},
      {"startPopServiceInstance", startPopServiceInstance}, {"readPopServiceInstance", readPopServiceInstance},
      {"claimExpiringNonce", claimExpiringNonce}, {"assertExpiringRequestFresh", assertExpiringRequestFresh}};
    for (const auto& item : functions) { napi_value function; napiCheck(napi_create_function(env, item.name, NAPI_AUTO_LENGTH, item.callback, nullptr, &function)); put(env, exports, item.name, function); }
    return exports;
  });
}
} // namespace
NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
