// Windows SCM host and guarded package installer. Check-only is the default.
// The existing TypeScript broker owns all checkpoint/HMAC semantics; this file
// supplies process, transport, deployment and ownership boundaries only.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <aclapi.h>
#include <sddl.h>
#include <shlobj.h>
#include <bcrypt.h>
#include <wincrypt.h>
#include <algorithm>
#include <array>
#include <chrono>
#include <cstdint>
#include <functional>
#include <iostream>
#include <map>
#include <memory>
#include <mutex>
#include <set>
#include <stdexcept>
#include <string>
#include <thread>
#include <utility>
#include <vector>

#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "bcrypt.lib")
#pragma comment(lib, "crypt32.lib")

namespace {
constexpr wchar_t ServiceName[] = L"UnifiedAiSystemLocalClientAuthorityBroker";
constexpr wchar_t ServiceAccount[] = L"NT SERVICE\\UnifiedAiSystemLocalClientAuthorityBroker";
constexpr wchar_t ServiceSid[] = L"S-1-5-80-2517572854-3647151239-2500651488-2982019916-1580030387";
constexpr wchar_t PipeName[] = L"\\\\.\\pipe\\UnifiedAiSystemLocalClientAuthorityBroker-v1";
constexpr wchar_t RegistryRoot[] = L"Software\\UnifiedAISystem\\LocalClientAuthority";
constexpr char PackageVersion[] = "local-client-windows-authority-package-v1";
constexpr char BootstrapVersion[] = "local-client-windows-authority-bootstrap-v1";
constexpr char OwnershipVersion[] = "local-client-windows-authority-installation-v1";
constexpr char NonceHeader[] = "UAI-AUTHORITY-NONCES-V1\n";
constexpr size_t MaxFrame = 65536, MaxPrivateFrame = 8 * MaxFrame;
constexpr DWORD RequestDeadlineMs = 8000;
const std::array<std::string, 7> PackageFiles = {"bin/authority-broker-host.exe", "bin/node.exe",
  "bin/authority-worker.mjs", "bin/authority-install.mjs", "bin/local-client-authority.node",
  "licenses/LICENSE.node", "licenses/LICENSE.project"};
const std::array<std::string, 12> AnchorIds = {"gateway-vscode", "client-vscode", "workcopy-vscode",
  "gateway-cursor", "client-cursor", "workcopy-cursor", "validation-gateway-vscode", "validation-client-vscode",
  "validation-workcopy-vscode", "validation-gateway-cursor", "validation-client-cursor", "validation-workcopy-cursor"};

[[noreturn]] void Reject(const char* code) { throw std::runtime_error(code); }
void Require(bool value, const char* code) { if (!value) Reject(code); }
struct Handle {
  HANDLE value = nullptr;
  Handle() = default;
  explicit Handle(HANDLE input) : value(input) {}
  ~Handle() { reset(); }
  Handle(Handle&& other) noexcept : value(std::exchange(other.value, nullptr)) {}
  Handle& operator=(Handle&& other) noexcept { if (this != &other) { reset(); value = std::exchange(other.value, nullptr); } return *this; }
  Handle(const Handle&) = delete;
  Handle& operator=(const Handle&) = delete;
  explicit operator bool() const { return value && value != INVALID_HANDLE_VALUE; }
  void reset(HANDLE next = nullptr) { if (*this) CloseHandle(value); value = next; }
};
struct ScHandle {
  SC_HANDLE value = nullptr;
  explicit ScHandle(SC_HANDLE input = nullptr) : value(input) {}
  ~ScHandle() { if (value) CloseServiceHandle(value); }
  ScHandle(const ScHandle&) = delete;
  ScHandle& operator=(const ScHandle&) = delete;
};
struct RegHandle {
  HKEY value = nullptr;
  RegHandle() = default;
  ~RegHandle() { if (value) RegCloseKey(value); }
  RegHandle(RegHandle&& other) noexcept : value(std::exchange(other.value, nullptr)) {}
  RegHandle& operator=(RegHandle&& other) noexcept { if (this != &other) { if (value) RegCloseKey(value); value = std::exchange(other.value, nullptr); } return *this; }
  RegHandle(const RegHandle&) = delete;
  RegHandle& operator=(const RegHandle&) = delete;
};
struct LocalMemory {
  HLOCAL value = nullptr;
  ~LocalMemory() { if (value) LocalFree(value); }
};
struct Secret {
  std::vector<unsigned char> bytes;
  explicit Secret(size_t size) : bytes(size) {}
  ~Secret() { if (!bytes.empty()) SecureZeroMemory(bytes.data(), bytes.size()); }
};
struct PrivateText {
  std::string value;
  ~PrivateText() { if (!value.empty()) SecureZeroMemory(value.data(), value.size()); }
};

std::wstring Wide(const std::string& value) {
  if (value.empty()) return {};
  int count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0);
  Require(count > 0, "INVALID_UTF8");
  std::wstring out(count, L'\0');
  Require(MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), out.data(), count) == count, "INVALID_UTF8");
  return out;
}
std::string Utf8(const std::wstring& value) {
  if (value.empty()) return {};
  int count = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  Require(count > 0, "INVALID_UNICODE");
  std::string out(count, '\0');
  Require(WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), out.data(), count, nullptr, nullptr) == count, "INVALID_UNICODE");
  return out;
}
bool Hex(const std::string& value, size_t size) {
  return value.size() == size && std::all_of(value.begin(), value.end(), [](char c) { return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'); });
}
std::string HexBytes(const unsigned char* bytes, size_t size) {
  constexpr char digits[] = "0123456789abcdef";
  std::string out(size * 2, '0');
  for (size_t i = 0; i < size; ++i) { out[i * 2] = digits[bytes[i] >> 4]; out[i * 2 + 1] = digits[bytes[i] & 15]; }
  return out;
}
std::string RandomId() {
  std::array<unsigned char, 16> bytes{};
  Require(BCryptGenRandom(nullptr, bytes.data(), static_cast<ULONG>(bytes.size()), BCRYPT_USE_SYSTEM_PREFERRED_RNG) == 0, "RANDOM_UNAVAILABLE");
  return HexBytes(bytes.data(), bytes.size());
}
std::string QuoteJson(const std::string& value) {
  std::string out = "\"";
  constexpr char digits[] = "0123456789abcdef";
  for (unsigned char c : value) {
    if (c == '"' || c == '\\') { out += '\\'; out += static_cast<char>(c); }
    else if (c < 32) { out += "\\u00"; out += digits[c >> 4]; out += digits[c & 15]; }
    else out += static_cast<char>(c);
  }
  return out + '"';
}

// A bounded data parser for the fixed package/config/worker envelopes. Duplicate
// members, excessive nesting, malformed UTF-8 and non-integer numbers fail closed.
struct Json {
  enum Kind { Null, Boolean, Number, String, Array, Object } kind = Null;
  std::string text;
  std::vector<Json> list;
  std::map<std::string, Json> members;
  const Json& at(const std::string& name) const { Require(kind == Object && members.count(name) == 1, "JSON_SHAPE_INVALID"); return members.at(name); }
  const std::string& string() const { Require(kind == String, "JSON_STRING_REQUIRED"); return text; }
  void exact(std::initializer_list<const char*> names) const {
    Require(kind == Object && members.size() == names.size(), "JSON_SHAPE_INVALID");
    for (auto name : names) Require(members.count(name) == 1, "JSON_SHAPE_INVALID");
  }
};
class JsonParser {
  const std::string& source; size_t offset = 0, nodes = 0;
  char peek() const { return offset < source.size() ? source[offset] : '\0'; }
  char take() { Require(offset < source.size(), "JSON_TRUNCATED"); return source[offset++]; }
  void space() { while (peek() == ' ' || peek() == '\t' || peek() == '\r' || peek() == '\n') ++offset; }
  unsigned hex4() {
    unsigned value = 0;
    for (int i = 0; i < 4; ++i) { char c = take(); value <<= 4;
      if (c >= '0' && c <= '9') value += c - '0'; else if (c >= 'a' && c <= 'f') value += c - 'a' + 10;
      else if (c >= 'A' && c <= 'F') value += c - 'A' + 10; else Reject("JSON_ESCAPE_INVALID"); }
    return value;
  }
  std::string string() {
    Require(take() == '"', "JSON_STRING_REQUIRED"); std::string out;
    while (peek() != '"') {
      unsigned char c = static_cast<unsigned char>(take()); Require(c >= 32, "JSON_CONTROL_INVALID");
      if (c != '\\') out += static_cast<char>(c);
      else {
        char escaped = take();
        if (escaped == '"' || escaped == '\\' || escaped == '/') out += escaped;
        else if (escaped == 'b') out += '\b'; else if (escaped == 'f') out += '\f';
        else if (escaped == 'n') out += '\n'; else if (escaped == 'r') out += '\r'; else if (escaped == 't') out += '\t';
        else if (escaped == 'u') {
          unsigned unit = hex4(); std::wstring utf16(1, static_cast<wchar_t>(unit));
          if (unit >= 0xd800 && unit <= 0xdbff) { Require(take() == '\\' && take() == 'u', "JSON_SURROGATE_INVALID");
            unsigned low = hex4(); Require(low >= 0xdc00 && low <= 0xdfff, "JSON_SURROGATE_INVALID"); utf16 += static_cast<wchar_t>(low); }
          else Require(unit < 0xdc00 || unit > 0xdfff, "JSON_SURROGATE_INVALID");
          out += Utf8(utf16);
        } else Reject("JSON_ESCAPE_INVALID");
      }
      Require(out.size() <= MaxPrivateFrame, "JSON_STRING_TOO_LARGE");
    }
    take(); return out;
  }
  Json value(unsigned depth) {
    Require(depth <= 8 && ++nodes <= 4096, "JSON_COMPLEXITY_LIMIT"); space(); Json out;
    if (peek() == '"') { out.kind = Json::String; out.text = string(); }
    else if (peek() == '{') {
      out.kind = Json::Object; take(); space();
      if (peek() != '}') do { space(); auto key = string(); space(); Require(take() == ':', "JSON_SHAPE_INVALID");
        Require(out.members.emplace(key, value(depth + 1)).second, "JSON_DUPLICATE_MEMBER"); space();
        if (peek() != ',') break; take();
      } while (true);
      Require(take() == '}', "JSON_SHAPE_INVALID");
    } else if (peek() == '[') {
      out.kind = Json::Array; take(); space();
      if (peek() != ']') do { out.list.push_back(value(depth + 1)); space(); if (peek() != ',') break; take(); } while (true);
      Require(take() == ']', "JSON_SHAPE_INVALID");
    } else if (peek() >= '0' && peek() <= '9') {
      out.kind = Json::Number; while (peek() >= '0' && peek() <= '9') out.text += take();
      Require(out.text.size() <= 20 && (out.text.size() == 1 || out.text[0] != '0'), "JSON_NUMBER_INVALID");
    } else {
      for (const auto& literal : {std::string("null"), std::string("true"), std::string("false")}) {
        if (source.compare(offset, literal.size(), literal) == 0) { offset += literal.size(); out.kind = literal == "null" ? Json::Null : Json::Boolean; out.text = literal; return out; }
      }
      Reject("JSON_VALUE_INVALID");
    }
    return out;
  }
public:
  explicit JsonParser(const std::string& input) : source(input) {}
  Json parse() { Require(!source.empty() && source.size() <= MaxPrivateFrame, "JSON_SIZE_INVALID"); Wide(source); auto out = value(0); space(); Require(offset == source.size(), "JSON_TRAILING_DATA"); return out; }
};

std::wstring Parent(const std::wstring& path) { auto slash = path.find_last_of(L"\\/"); Require(slash != std::wstring::npos, "PATH_INVALID"); return path.substr(0, slash); }
std::wstring Join(const std::wstring& path, const std::wstring& name) { return path + L"\\" + name; }
bool SamePath(const std::wstring& left, const std::wstring& right) { return CompareStringOrdinal(left.c_str(), -1, right.c_str(), -1, TRUE) == CSTR_EQUAL; }
std::wstring FullPath(const std::wstring& value) {
  Require(value.size() >= 3 && value.size() < 4096 && ((value[0] >= L'A' && value[0] <= L'Z') || (value[0] >= L'a' && value[0] <= L'z'))
    && value[1] == L':' && value[2] == L'\\' && value.find(L':', 2) == std::wstring::npos && value.find(L'\0') == std::wstring::npos, "PATH_INVALID");
  std::vector<wchar_t> buffer(32768); DWORD count = GetFullPathNameW(value.c_str(), static_cast<DWORD>(buffer.size()), buffer.data(), nullptr);
  Require(count > 0 && count < buffer.size(), "PATH_INVALID"); std::wstring out(buffer.data(), count);
  Require(SamePath(out, value), "PATH_NOT_CANONICAL"); return out;
}
std::wstring ModulePath() { std::vector<wchar_t> path(32768); DWORD size = GetModuleFileNameW(nullptr, path.data(), static_cast<DWORD>(path.size())); Require(size && size < path.size(), "MODULE_PATH_UNAVAILABLE"); return FullPath(std::wstring(path.data(), size)); }
std::wstring ProgramData() {
  PWSTR path = nullptr; Require(SUCCEEDED(SHGetKnownFolderPath(FOLDERID_ProgramData, KF_FLAG_DEFAULT, nullptr, &path)), "PROGRAM_DATA_UNAVAILABLE");
  std::wstring out(path); CoTaskMemFree(path); return FullPath(out);
}
std::wstring AuthorityRoot(const std::wstring& base) { return Join(base, L"UnifiedAISystem\\LocalClientAuthority"); }
std::wstring FinalPath(HANDLE file) {
  std::vector<wchar_t> buffer(32768); DWORD size = GetFinalPathNameByHandleW(file, buffer.data(), static_cast<DWORD>(buffer.size()), FILE_NAME_NORMALIZED | VOLUME_NAME_DOS);
  Require(size && size < buffer.size(), "FINAL_PATH_UNAVAILABLE"); std::wstring out(buffer.data(), size);
  Require(out.rfind(L"\\\\?\\", 0) == 0, "FINAL_PATH_INVALID"); return out.substr(4);
}
Handle OpenPath(const std::wstring& path, bool directory, DWORD access = GENERIC_READ, DWORD sharing = FILE_SHARE_READ) {
  Handle file(CreateFileW(path.c_str(), access, sharing, nullptr, OPEN_EXISTING,
    FILE_FLAG_OPEN_REPARSE_POINT | (directory ? FILE_FLAG_BACKUP_SEMANTICS : FILE_ATTRIBUTE_NORMAL), nullptr));
  Require(static_cast<bool>(file), "PATH_OPEN_REJECTED"); BY_HANDLE_FILE_INFORMATION info{};
  Require(GetFileInformationByHandle(file.value, &info) && !(info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT)
    && !!(info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) == directory && (directory || info.nNumberOfLinks == 1)
    && SamePath(FinalPath(file.value), path), "PATH_TOPOLOGY_REJECTED");
  return file;
}
std::vector<Handle> HoldDirectories(const std::wstring& directory) {
  FullPath(directory); std::vector<Handle> held;
  for (size_t end = 3; end <= directory.size();) {
    held.push_back(OpenPath(directory.substr(0, end), true, FILE_READ_ATTRIBUTES | READ_CONTROL, FILE_SHARE_READ | FILE_SHARE_WRITE));
    if (end == directory.size()) break;
    auto next = directory.find(L'\\', end + (end == 3 ? 0 : 1)); end = next == std::wstring::npos ? directory.size() : next;
  }
  return held;
}
void SeekStart(HANDLE file) { LARGE_INTEGER zero{}; Require(SetFilePointerEx(file, zero, nullptr, FILE_BEGIN), "FILE_SEEK_FAILED"); }
std::string ReadFileBounded(HANDLE file, size_t maximum) {
  LARGE_INTEGER size{}; Require(GetFileSizeEx(file, &size) && size.QuadPart >= 0 && static_cast<unsigned long long>(size.QuadPart) <= maximum, "FILE_SIZE_REJECTED");
  SeekStart(file); std::string out(static_cast<size_t>(size.QuadPart), '\0'); size_t offset = 0;
  while (offset < out.size()) { DWORD read = 0; Require(ReadFile(file, out.data() + offset, static_cast<DWORD>(out.size() - offset), &read, nullptr) && read, "FILE_READ_FAILED"); offset += read; }
  return out;
}
std::string HashFile(HANDLE file, unsigned long long maximum = 256ull * 1024 * 1024) {
  LARGE_INTEGER size{}; Require(GetFileSizeEx(file, &size) && size.QuadPart >= 0 && static_cast<unsigned long long>(size.QuadPart) <= maximum, "FILE_SIZE_REJECTED");
  BCRYPT_ALG_HANDLE algorithm = nullptr; BCRYPT_HASH_HANDLE hash = nullptr; std::array<unsigned char, 32> digest{};
  Require(BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) == 0, "HASH_UNAVAILABLE");
  try {
    Require(BCryptCreateHash(algorithm, &hash, nullptr, 0, nullptr, 0, 0) == 0, "HASH_UNAVAILABLE"); SeekStart(file);
    std::array<unsigned char, 65536> buffer{}; DWORD read = 0;
    do { Require(ReadFile(file, buffer.data(), static_cast<DWORD>(buffer.size()), &read, nullptr), "FILE_READ_FAILED");
      if (read) Require(BCryptHashData(hash, buffer.data(), read, 0) == 0, "HASH_UNAVAILABLE"); } while (read);
    Require(BCryptFinishHash(hash, digest.data(), static_cast<ULONG>(digest.size()), 0) == 0, "HASH_UNAVAILABLE");
  } catch (...) { if (hash) BCryptDestroyHash(hash); BCryptCloseAlgorithmProvider(algorithm, 0); throw; }
  BCryptDestroyHash(hash); BCryptCloseAlgorithmProvider(algorithm, 0); return HexBytes(digest.data(), digest.size());
}
void WriteAll(HANDLE file, const char* bytes, size_t size) {
  size_t offset = 0; while (offset < size) { DWORD written = 0; Require(WriteFile(file, bytes + offset,
    static_cast<DWORD>(std::min<size_t>(size - offset, 65536)), &written, nullptr) && written, "FILE_WRITE_FAILED"); offset += written; }
}

struct Sid {
  LocalMemory memory;
  explicit Sid(const std::wstring& text) { Require(ConvertStringSidToSidW(text.c_str(), reinterpret_cast<PSID*>(&memory.value)), "SID_INVALID"); }
  PSID get() const { return memory.value; }
};
std::wstring TokenUserSid(HANDLE token) {
  DWORD size = 0; GetTokenInformation(token, TokenUser, nullptr, 0, &size); Require(size && size < 65536, "TOKEN_QUERY_REJECTED");
  std::vector<unsigned char> data(size); Require(GetTokenInformation(token, TokenUser, data.data(), size, &size), "TOKEN_QUERY_REJECTED");
  LocalMemory text; Require(ConvertSidToStringSidW(reinterpret_cast<TOKEN_USER*>(data.data())->User.Sid, reinterpret_cast<LPWSTR*>(&text.value)), "TOKEN_QUERY_REJECTED");
  return static_cast<LPWSTR>(text.value);
}
bool TokenHasServiceSid(HANDLE token) {
  if (TokenUserSid(token) == ServiceSid) return true;
  DWORD size = 0; GetTokenInformation(token, TokenGroups, nullptr, 0, &size); Require(size && size < 65536, "TOKEN_QUERY_REJECTED");
  std::vector<unsigned char> data(size); Require(GetTokenInformation(token, TokenGroups, data.data(), size, &size), "TOKEN_QUERY_REJECTED");
  Sid expected(ServiceSid); auto groups = reinterpret_cast<TOKEN_GROUPS*>(data.data());
  for (DWORD i = 0; i < groups->GroupCount; ++i) if (EqualSid(groups->Groups[i].Sid, expected.get())
    && (groups->Groups[i].Attributes & SE_GROUP_ENABLED) && !(groups->Groups[i].Attributes & SE_GROUP_USE_FOR_DENY_ONLY)) return true;
  return false;
}
struct Security {
  LocalMemory memory;
  SECURITY_ATTRIBUTES attributes{sizeof(SECURITY_ATTRIBUTES), nullptr, FALSE};
  explicit Security(const std::wstring& sddl) { Require(ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl.c_str(), SDDL_REVISION_1,
    reinterpret_cast<PSECURITY_DESCRIPTOR*>(&memory.value), nullptr), "SECURITY_DESCRIPTOR_REJECTED"); attributes.lpSecurityDescriptor = memory.value; }
};
std::wstring ObjectAcl(const std::wstring& caller, bool privateState, bool registry = false) {
  const std::wstring all = registry ? L"KA" : L"FA", read = registry ? L"KR" : L"0x1200a9";
  std::wstring out = L"O:BAG:BAD:P(A;OICI;" + all + L";;;SY)(A;OICI;" + all + L";;;BA)(A;OICI;" + all + L";;;" + ServiceSid + L")";
  if (!privateState) out += L"(A;OICI;" + read + L";;;" + caller + L")";
  return out;
}
void CheckProtectedAcl(HANDLE object, bool privateState = false) {
  PSECURITY_DESCRIPTOR descriptor = nullptr; PSID owner = nullptr; PACL acl = nullptr;
  Require(GetSecurityInfo(object, SE_FILE_OBJECT, OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
    &owner, nullptr, &acl, nullptr, &descriptor) == ERROR_SUCCESS, "ACL_INSPECTION_FAILED"); LocalMemory memory; memory.value = descriptor;
  SECURITY_DESCRIPTOR_CONTROL control{}; DWORD revision = 0;
  Sid system(L"S-1-5-18"), admins(L"S-1-5-32-544"), service(ServiceSid);
  auto trusted = [&](PSID sid) { return EqualSid(sid, system.get()) || EqualSid(sid, admins.get()) || EqualSid(sid, service.get()); };
  Require(owner && trusted(owner) && acl && GetSecurityDescriptorControl(descriptor, &control, &revision) && (control & SE_DACL_PROTECTED), "ACL_PROTECTION_REJECTED");
  GENERIC_MAPPING mapping{FILE_GENERIC_READ, FILE_GENERIC_WRITE, FILE_GENERIC_EXECUTE, FILE_ALL_ACCESS};
  constexpr DWORD writes = FILE_WRITE_DATA | FILE_APPEND_DATA | FILE_WRITE_EA | FILE_WRITE_ATTRIBUTES | DELETE | WRITE_DAC | WRITE_OWNER | FILE_DELETE_CHILD;
  for (DWORD i = 0; i < acl->AceCount; ++i) {
    void* raw = nullptr; Require(GetAce(acl, i, &raw), "ACL_INSPECTION_FAILED"); auto header = static_cast<ACE_HEADER*>(raw);
    Require(header->AceType == ACCESS_ALLOWED_ACE_TYPE, "ACL_ACE_REJECTED"); auto ace = static_cast<ACCESS_ALLOWED_ACE*>(raw); DWORD mask = ace->Mask;
    MapGenericMask(&mask, &mapping); if (mask & (writes | (privateState ? FILE_GENERIC_READ | FILE_GENERIC_EXECUTE : 0)))
      Require(trusted(&ace->SidStart), "ACL_PRINCIPAL_REJECTED");
  }
}
void CheckAncestorAcl(HANDLE directory) {
  PSECURITY_DESCRIPTOR descriptor = nullptr; PSID owner = nullptr; PACL acl = nullptr;
  Require(GetSecurityInfo(directory, SE_FILE_OBJECT, OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
    &owner, nullptr, &acl, nullptr, &descriptor) == ERROR_SUCCESS, "ANCESTOR_ACL_UNAVAILABLE"); LocalMemory memory; memory.value = descriptor;
  Sid system(L"S-1-5-18"), admins(L"S-1-5-32-544"), service(ServiceSid),
    installer(L"S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464");
  auto trusted = [&](PSID sid) { return sid && (EqualSid(sid, system.get()) || EqualSid(sid, admins.get())
    || EqualSid(sid, service.get()) || EqualSid(sid, installer.get())); };
  Require(trusted(owner) && acl, "ANCESTOR_OWNER_REJECTED");
  GENERIC_MAPPING mapping{FILE_GENERIC_READ, FILE_GENERIC_WRITE, FILE_GENERIC_EXECUTE, FILE_ALL_ACCESS};
  for (DWORD i = 0; i < acl->AceCount; ++i) { void* raw = nullptr; Require(GetAce(acl, i, &raw), "ANCESTOR_ACL_UNAVAILABLE");
    auto header = static_cast<ACE_HEADER*>(raw); if (header->AceFlags & INHERIT_ONLY_ACE) continue;
    if (header->AceType == ACCESS_DENIED_ACE_TYPE) continue;
    Require(header->AceType == ACCESS_ALLOWED_ACE_TYPE, "ANCESTOR_ACE_REJECTED"); auto ace = static_cast<ACCESS_ALLOWED_ACE*>(raw);
    DWORD mask = ace->Mask; MapGenericMask(&mask, &mapping);
    if (mask & (DELETE | FILE_DELETE_CHILD | WRITE_DAC | WRITE_OWNER)) Require(trusted(&ace->SidStart), "ANCESTOR_REPLACEMENT_REJECTED");
  }
}
void CheckRegistryDescriptor(PSECURITY_DESCRIPTOR descriptor, bool allowCreatorTemplate = false) {
  PSID owner = nullptr; PACL acl = nullptr; BOOL defaulted = FALSE, present = FALSE;
  Require(GetSecurityDescriptorOwner(descriptor, &owner, &defaulted) && GetSecurityDescriptorDacl(descriptor, &present, &acl, &defaulted) && present && acl, "REGISTRY_ACL_REJECTED");
  Sid system(L"S-1-5-18"), admins(L"S-1-5-32-544"), service(ServiceSid), creatorOwner(L"S-1-3-0"),
    installer(L"S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464");
  auto trusted = [&](PSID sid) { return sid && (EqualSid(sid, system.get()) || EqualSid(sid, admins.get())
    || EqualSid(sid, service.get()) || EqualSid(sid, installer.get())); };
  Require(trusted(owner), "REGISTRY_OWNER_REJECTED"); GENERIC_MAPPING mapping{KEY_READ, KEY_WRITE, KEY_EXECUTE, KEY_ALL_ACCESS};
  for (DWORD i = 0; i < acl->AceCount; ++i) { void* raw = nullptr; Require(GetAce(acl, i, &raw), "REGISTRY_ACL_UNAVAILABLE");
    auto header = static_cast<ACE_HEADER*>(raw); if ((header->AceFlags & INHERIT_ONLY_ACE) || header->AceType == ACCESS_DENIED_ACE_TYPE) continue;
    Require(header->AceType == ACCESS_ALLOWED_ACE_TYPE, "REGISTRY_ACE_REJECTED"); auto ace = static_cast<ACCESS_ALLOWED_ACE*>(raw);
    // Only checked HKLM\Software may retain this inheritable SID template. It
    // is not an actual token principal or a shorthand for the current owner.
    // Owned/company/slot keys retain the default strict policy.
    if (allowCreatorTemplate && (header->AceFlags & (CONTAINER_INHERIT_ACE | OBJECT_INHERIT_ACE))
      && EqualSid(&ace->SidStart, creatorOwner.get())) continue;
    DWORD mask = ace->Mask; MapGenericMask(&mask, &mapping);
    if (mask & (KEY_SET_VALUE | KEY_CREATE_SUB_KEY | KEY_CREATE_LINK | DELETE | WRITE_DAC | WRITE_OWNER))
      Require(trusted(&ace->SidStart), "REGISTRY_PARENT_WRITE_REJECTED");
  }
}
void CheckRegistryParent(HKEY key, bool allowCreatorTemplate = false) {
  DWORD type = 0, bytes = 0; auto linkStatus = RegQueryValueExW(key, L"SymbolicLinkValue", nullptr, &type, nullptr, &bytes);
  Require(linkStatus == ERROR_FILE_NOT_FOUND || (linkStatus == ERROR_SUCCESS && type != REG_LINK), "REGISTRY_LINK_REJECTED");
  DWORD needed = 0; auto status = RegGetKeySecurity(key, OWNER_SECURITY_INFORMATION | GROUP_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION, nullptr, &needed);
  Require(status == ERROR_INSUFFICIENT_BUFFER && needed && needed <= MaxFrame, "REGISTRY_ACL_UNAVAILABLE");
  std::vector<unsigned char> storage(needed); auto descriptor = reinterpret_cast<PSECURITY_DESCRIPTOR>(storage.data());
  Require(RegGetKeySecurity(key, OWNER_SECURITY_INFORMATION | GROUP_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION, descriptor, &needed) == ERROR_SUCCESS, "REGISTRY_ACL_UNAVAILABLE");
  CheckRegistryDescriptor(descriptor, allowCreatorTemplate);
}
RegHandle OpenRegistryChild(HKEY parent, const wchar_t* name, bool writing, bool missingAllowed, bool allowCreatorTemplate = false) {
  if (allowCreatorTemplate) Require(parent == HKEY_LOCAL_MACHINE && std::wstring(name) == L"Software", "REGISTRY_TEMPLATE_SCOPE_REJECTED");
  RegHandle key; auto status = RegOpenKeyExW(parent, name, REG_OPTION_OPEN_LINK,
    KEY_READ | READ_CONTROL | KEY_WOW64_64KEY | (writing ? KEY_CREATE_SUB_KEY : 0), &key.value);
  if (missingAllowed && (status == ERROR_FILE_NOT_FOUND || status == ERROR_PATH_NOT_FOUND)) return key;
  Require(status == ERROR_SUCCESS, "REGISTRY_OPEN_REJECTED"); CheckRegistryParent(key.value, allowCreatorTemplate); return key;
}
struct RegistryParents { RegHandle software, product; };
RegistryParents OpenRegistryParents(bool writing) {
  RegistryParents parents;
  parents.software = OpenRegistryChild(HKEY_LOCAL_MACHINE, L"Software", writing, false, true);
  parents.product = OpenRegistryChild(parents.software.value, L"UnifiedAISystem", writing, true);
  return parents;
}

struct Package {
  std::wstring root;
  std::vector<Handle> directories;
  Handle manifest;
  std::string manifestHash;
  std::map<std::string, std::string> hashes;
  std::vector<Handle> files;
};
void CheckAnchorList(const Json& anchors) {
  Require(anchors.kind == Json::Array && anchors.list.size() == AnchorIds.size(), "ANCHOR_SET_INVALID"); std::set<std::string> actual;
  for (const auto& value : anchors.list) Require(actual.insert(value.string()).second, "ANCHOR_SET_INVALID");
  Require(actual == std::set<std::string>(AnchorIds.begin(), AnchorIds.end()), "ANCHOR_SET_INVALID");
}
Package OpenPackage(const std::wstring& root, const std::string& expectedHash) {
  Package out; out.root = FullPath(root); out.directories = HoldDirectories(Join(root, L"bin"));
  auto licenseDirectories = HoldDirectories(Join(root, L"licenses"));
  for (auto& directory : licenseDirectories) out.directories.push_back(std::move(directory));
  out.manifest = OpenPath(Join(root, L"package-manifest.json"), false); out.manifestHash = HashFile(out.manifest.value, MaxFrame);
  if (!expectedHash.empty()) Require(Hex(expectedHash, 64) && out.manifestHash == expectedHash, "MANIFEST_PIN_MISMATCH");
  auto manifest = JsonParser(ReadFileBounded(out.manifest.value, MaxFrame)).parse(); manifest.exact({"version", "files", "anchorIds"});
  Require(manifest.at("version").string() == PackageVersion, "PACKAGE_VERSION_INVALID"); CheckAnchorList(manifest.at("anchorIds"));
  const auto& files = manifest.at("files"); Require(files.kind == Json::Array && files.list.size() == PackageFiles.size(), "PACKAGE_FILES_INVALID");
  for (const auto& value : files.list) { value.exact({"path", "sha256"}); const auto& path = value.at("path").string(); const auto& hash = value.at("sha256").string();
    Require(std::find(PackageFiles.begin(), PackageFiles.end(), path) != PackageFiles.end() && Hex(hash, 64)
      && out.hashes.emplace(path, hash).second, "PACKAGE_FILES_INVALID"); }
  for (const auto& name : PackageFiles) {
    auto path = Wide(name); std::replace(path.begin(), path.end(), L'/', L'\\');
    auto file = OpenPath(Join(root, path), false); Require(HashFile(file.value) == out.hashes.at(name), "PACKAGE_FILE_MISMATCH"); out.files.push_back(std::move(file));
  }
  return out;
}

std::wstring QuoteArgument(const std::wstring& input) {
  std::wstring out = L"\""; size_t slashes = 0;
  for (wchar_t c : input) { if (c == L'\\') { ++slashes; continue; }
    out.append(slashes * (c == L'"' ? 2 : 1), L'\\'); slashes = 0; if (c == L'"') out += L'\\'; out += c; }
  out.append(slashes * 2, L'\\'); return out + L'"';
}
std::vector<wchar_t> WorkerEnvironment(const std::wstring& root) {
  std::array<wchar_t, MAX_PATH> windows{}; UINT count = GetWindowsDirectoryW(windows.data(), static_cast<UINT>(windows.size())); Require(count && count < windows.size(), "WINDOWS_DIRECTORY_UNAVAILABLE");
  const std::wstring base = FullPath(std::wstring(windows.data(), count)), machineProgramData = ProgramData();
  Require(SamePath(AuthorityRoot(machineProgramData), root), "WORKER_ROOT_BINDING_MISMATCH");
  std::vector<wchar_t> out;
  // Machine-wide values come from native host facts, never inherited user env.
  // Windows requires case-insensitive alphabetical ordering of the environment block.
  for (const auto& value : {L"ALLUSERSPROFILE=" + machineProgramData, L"PATH=" + Join(base, L"System32"),
    L"ProgramData=" + machineProgramData, L"SystemDrive=" + base.substr(0, 2), L"SystemRoot=" + base,
    L"TEMP=" + Join(root, L"scratch"), L"TMP=" + Join(root, L"scratch"), L"WINDIR=" + base}) { out.insert(out.end(), value.begin(), value.end()); out.push_back(L'\0'); }
  out.push_back(L'\0'); return out;
}
bool PeerConnected(HANDLE pipe) { DWORD remaining = 0; return PeekNamedPipe(pipe, nullptr, 0, nullptr, &remaining, nullptr) && remaining == 0; }
DWORD Remaining(ULONGLONG deadline) { auto now = GetTickCount64(); return now >= deadline ? 0 : static_cast<DWORD>(deadline - now); }

// One child owns one authenticated request. Closing the job also closes every
// duplicated token/lease; an expired or disconnected request cannot outlive it.
std::string RunWorker(const std::wstring& root, const wchar_t* entry, const std::function<std::string(HANDLE)>& makeInput,
  HANDLE stop = nullptr, HANDLE peer = nullptr, const wchar_t* mode = nullptr, ULONGLONG absoluteDeadline = 0) {
  const ULONGLONG deadline = absoluteDeadline ? absoluteDeadline : GetTickCount64() + RequestDeadlineMs;
  SECURITY_ATTRIBUTES inheritance{sizeof(SECURITY_ATTRIBUTES), nullptr, TRUE}; Handle inRead, inWrite, outRead, outWrite;
  Require(CreatePipe(&inRead.value, &inWrite.value, &inheritance, static_cast<DWORD>(MaxPrivateFrame + 4096))
    && CreatePipe(&outRead.value, &outWrite.value, &inheritance, static_cast<DWORD>(MaxPrivateFrame + 4096)), "PRIVATE_PIPE_UNAVAILABLE");
  Require(SetHandleInformation(inWrite.value, HANDLE_FLAG_INHERIT, 0) && SetHandleInformation(outRead.value, HANDLE_FLAG_INHERIT, 0), "PRIVATE_PIPE_UNAVAILABLE");
  Handle nullError(CreateFileW(L"NUL", GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, &inheritance, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr));
  Require(static_cast<bool>(nullError), "PRIVATE_STDERR_UNAVAILABLE");
  SIZE_T attributeBytes = 0; InitializeProcThreadAttributeList(nullptr, 1, 0, &attributeBytes);
  std::vector<unsigned char> attributeBuffer(attributeBytes); auto attributes = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(attributeBuffer.data());
  Require(InitializeProcThreadAttributeList(attributes, 1, 0, &attributeBytes), "PROCESS_ATTRIBUTES_UNAVAILABLE");
  Handle job(CreateJobObjectW(nullptr, nullptr)); Handle process, thread;
  try {
    std::array<HANDLE, 3> inherited{inRead.value, outWrite.value, nullError.value};
    Require(UpdateProcThreadAttribute(attributes, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST, inherited.data(), sizeof(inherited), nullptr, nullptr), "PROCESS_ATTRIBUTES_UNAVAILABLE");
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_ACTIVE_PROCESS | JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION;
    limits.BasicLimitInformation.ActiveProcessLimit = 1;
    Require(job && SetInformationJobObject(job.value, JobObjectExtendedLimitInformation, &limits, sizeof(limits)), "JOB_UNAVAILABLE");
    const auto bin = Join(root, L"bin"), node = Join(bin, L"node.exe");
    auto command = QuoteArgument(node) + L" --no-warnings --disable-proto=throw " + QuoteArgument(Join(bin, entry)); if (mode) command += L" " + std::wstring(mode);
    auto environment = WorkerEnvironment(root); STARTUPINFOEXW startup{}; startup.StartupInfo.cb = sizeof(startup);
    startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES; startup.StartupInfo.hStdInput = inRead.value;
    startup.StartupInfo.hStdOutput = outWrite.value; startup.StartupInfo.hStdError = nullError.value; startup.lpAttributeList = attributes;
    PROCESS_INFORMATION created{};
    Require(CreateProcessW(node.c_str(), command.data(), nullptr, nullptr, TRUE,
      CREATE_NO_WINDOW | CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT | EXTENDED_STARTUPINFO_PRESENT,
      environment.data(), bin.c_str(), &startup.StartupInfo, &created), "WORKER_START_REJECTED");
    process.reset(created.hProcess); thread.reset(created.hThread);
    if (!AssignProcessToJobObject(job.value, process.value)) { TerminateProcess(process.value, 2); Reject("WORKER_JOB_REJECTED"); }
    PrivateText input; input.value = makeInput(process.value); Require(!input.value.empty() && input.value.size() <= MaxPrivateFrame
      && input.value.find('\n') == std::string::npos && input.value.find('\r') == std::string::npos, "PRIVATE_FRAME_INVALID"); input.value += '\n';
    Require(Remaining(deadline) && (!stop || WaitForSingleObject(stop, 0) != WAIT_OBJECT_0) && (!peer || PeerConnected(peer)), "WORKER_CANCELLED");
    Require(ResumeThread(thread.value) != static_cast<DWORD>(-1), "WORKER_START_REJECTED"); inRead.reset(); outWrite.reset(); nullError.reset();
    std::string reply; bool success = false;
    std::thread io([&] {
      try { WriteAll(inWrite.value, input.value.data(), input.value.size()); inWrite.reset();
        for (;;) { char byte = 0; DWORD read = 0; Require(ReadFile(outRead.value, &byte, 1, &read, nullptr) && read == 1, "WORKER_REPLY_TRUNCATED");
          if (byte == '\n') break; Require(byte != '\r' && reply.size() < MaxPrivateFrame, "PRIVATE_FRAME_INVALID"); reply += byte; }
        Require(!reply.empty(), "PRIVATE_FRAME_INVALID"); Wide(reply); success = true;
      } catch (...) { success = false; }
    });
    bool cancelled = false;
    while (WaitForSingleObject(io.native_handle(), 10) == WAIT_TIMEOUT) {
      if (!Remaining(deadline) || (stop && WaitForSingleObject(stop, 0) == WAIT_OBJECT_0) || (peer && !PeerConnected(peer))) {
        cancelled = true; CancelSynchronousIo(io.native_handle()); TerminateJobObject(job.value, 2); break;
      }
    }
    if (cancelled) { CancelSynchronousIo(io.native_handle()); TerminateJobObject(job.value, 2); }
    io.join(); TerminateJobObject(job.value, success && !cancelled ? 0 : 2);
    Require(WaitForSingleObject(process.value, 2000) == WAIT_OBJECT_0, "WORKER_CLEANUP_FAILED");
    Require(success && !cancelled && (!peer || PeerConnected(peer)), "WORKER_REQUEST_REJECTED");
    DeleteProcThreadAttributeList(attributes); return reply;
  } catch (...) { if (job) TerminateJobObject(job.value, 2); if (process) WaitForSingleObject(process.value, 2000); DeleteProcThreadAttributeList(attributes); throw; }
}

std::string AnchorsJson() {
  std::string out = "["; for (const auto& id : AnchorIds) { if (out.size() > 1) out += ','; out += QuoteJson(id); } return out + ']';
}
std::string FilesJson(const std::map<std::string, std::string>& hashes) {
  std::string out = "["; for (const auto& name : PackageFiles) { if (out.size() > 1) out += ',';
    out += "{\"path\":" + QuoteJson(name) + ",\"sha256\":" + QuoteJson(hashes.at(name)) + '}'; } return out + ']';
}
std::string RootIdentity(HANDLE root) {
  BY_HANDLE_FILE_INFORMATION info{}; Require(GetFileInformationByHandle(root, &info), "ROOT_IDENTITY_UNAVAILABLE");
  auto index = (static_cast<unsigned long long>(info.nFileIndexHigh) << 32) | info.nFileIndexLow;
  return std::to_string(info.dwVolumeSerialNumber) + ':' + std::to_string(index);
}
bool PathExists(const std::wstring& path) {
  if (GetFileAttributesW(path.c_str()) != INVALID_FILE_ATTRIBUTES) return true;
  DWORD error = GetLastError(); Require(error == ERROR_FILE_NOT_FOUND || error == ERROR_PATH_NOT_FOUND, "PATH_STATE_UNAVAILABLE"); return false;
}
bool RegistryExists() {
  auto parents = OpenRegistryParents(false); if (!parents.product.value) return false;
  auto root = OpenRegistryChild(parents.product.value, L"LocalClientAuthority", false, true); return root.value != nullptr;
}
ScHandle* OpenServiceRead(SC_HANDLE manager) {
  auto service = OpenServiceW(manager, ServiceName, SERVICE_QUERY_CONFIG | SERVICE_QUERY_STATUS);
  if (!service) { Require(GetLastError() == ERROR_SERVICE_DOES_NOT_EXIST, "SERVICE_STATE_UNAVAILABLE"); return nullptr; }
  return new ScHandle(service);
}
std::wstring ServiceCommand(const std::wstring& root) { return QuoteArgument(Join(root, L"bin\\authority-broker-host.exe")) + L" --service"; }
void CheckServiceConfiguration(SC_HANDLE service, const std::wstring& root, bool allowIncompleteSid = false) {
  DWORD bytes = 0; QueryServiceConfigW(service, nullptr, 0, &bytes); Require(bytes && bytes <= MaxFrame, "SERVICE_CONFIGURATION_UNAVAILABLE");
  std::vector<unsigned char> storage(bytes); auto config = reinterpret_cast<QUERY_SERVICE_CONFIGW*>(storage.data());
  Require(QueryServiceConfigW(service, config, bytes, &bytes) && config->dwServiceType == SERVICE_WIN32_OWN_PROCESS
    && config->dwStartType == SERVICE_DEMAND_START && SamePath(config->lpBinaryPathName, ServiceCommand(root))
    && CompareStringOrdinal(config->lpServiceStartName, -1, ServiceAccount, -1, TRUE) == CSTR_EQUAL, "SERVICE_OWNERSHIP_MISMATCH");
  SERVICE_SID_INFO sid{}; Require(QueryServiceConfig2W(service, SERVICE_CONFIG_SERVICE_SID_INFO, reinterpret_cast<BYTE*>(&sid), sizeof(sid), &bytes), "SERVICE_CONFIGURATION_UNAVAILABLE");
  Require(sid.dwServiceSidType == SERVICE_SID_TYPE_UNRESTRICTED || (allowIncompleteSid && sid.dwServiceSidType == SERVICE_SID_TYPE_NONE), "SERVICE_IDENTITY_MISMATCH");
}
struct Operator {
  std::wstring sid;
  Handle probe;
  bool elevated = false;
};
Operator ReadOperator() {
  Handle token; Require(OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY | TOKEN_DUPLICATE, &token.value), "OPERATOR_UNAVAILABLE");
  Operator out; out.sid = TokenUserSid(token.value); Require(out.sid.rfind(L"S-1-5-21-", 0) == 0, "OPERATOR_SID_UNSUPPORTED");
  TOKEN_ELEVATION elevation{}; DWORD bytes = 0;
  Require(GetTokenInformation(token.value, TokenElevation, &elevation, sizeof(elevation), &bytes), "OPERATOR_UNAVAILABLE"); out.elevated = elevation.TokenIsElevated != 0;
  Handle linked; TOKEN_ELEVATION_TYPE type{};
  Require(GetTokenInformation(token.value, TokenElevationType, &type, sizeof(type), &bytes), "OPERATOR_UNAVAILABLE");
  if (type == TokenElevationTypeFull) { TOKEN_LINKED_TOKEN value{};
    Require(GetTokenInformation(token.value, TokenLinkedToken, &value, sizeof(value), &bytes), "OPERATOR_LINKED_TOKEN_UNAVAILABLE"); linked.reset(value.LinkedToken);
    Require(TokenUserSid(linked.value) == out.sid, "OPERATOR_BINDING_MISMATCH"); }
  // AccessCheck needs only an identification token. UAC's linked token may be
  // identification-only and cannot be duplicated to a higher impersonation level.
  Require(DuplicateTokenEx(linked ? linked.value : token.value, TOKEN_QUERY, nullptr,
    SecurityIdentification, TokenImpersonation, &out.probe.value), "OPERATOR_PROBE_UNAVAILABLE"); return out;
}
DWORD AccessMask(PSECURITY_DESCRIPTOR descriptor, HANDLE token, bool registry = false) {
  GENERIC_MAPPING mapping = registry ? GENERIC_MAPPING{KEY_READ, KEY_WRITE, KEY_EXECUTE, KEY_ALL_ACCESS}
    : GENERIC_MAPPING{FILE_GENERIC_READ, FILE_GENERIC_WRITE, FILE_GENERIC_EXECUTE, FILE_ALL_ACCESS};
  std::array<unsigned char, 4096> privileges{}; DWORD privilegeBytes = static_cast<DWORD>(privileges.size()), granted = 0; BOOL status = FALSE;
  Require(AccessCheck(descriptor, token, MAXIMUM_ALLOWED, &mapping, reinterpret_cast<PRIVILEGE_SET*>(privileges.data()),
    &privilegeBytes, &granted, &status), "OPERATOR_ACCESS_CHECK_FAILED"); return status ? granted : 0;
}
void VerifyOperatorFileAccess(HANDLE file, HANDLE token, bool readable) {
  PSECURITY_DESCRIPTOR descriptor = nullptr;
  Require(GetSecurityInfo(file, SE_FILE_OBJECT, OWNER_SECURITY_INFORMATION | GROUP_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
    nullptr, nullptr, nullptr, nullptr, &descriptor) == ERROR_SUCCESS, "ACL_INSPECTION_FAILED"); LocalMemory memory; memory.value = descriptor;
  DWORD access = AccessMask(descriptor, token);
  Require(!(access & (FILE_WRITE_DATA | FILE_APPEND_DATA | FILE_WRITE_EA | FILE_WRITE_ATTRIBUTES | DELETE | WRITE_DAC | WRITE_OWNER | FILE_DELETE_CHILD))
    && !!(access & FILE_READ_DATA) == readable, "OPERATOR_ACCESS_REJECTED");
}
void CreateOwnedDirectory(const std::wstring& path, Security& security) { Require(CreateDirectoryW(path.c_str(), &security.attributes), "OWNED_DIRECTORY_CONFLICT"); }
void WriteNewFile(const std::wstring& path, const char* data, size_t size, Security& security) {
  Handle file(CreateFileW(path.c_str(), GENERIC_WRITE | GENERIC_READ | READ_CONTROL, FILE_SHARE_READ,
    &security.attributes, CREATE_NEW, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
  Require(file && SamePath(FinalPath(file.value), path), "OWNED_FILE_CONFLICT"); WriteAll(file.value, data, size); Require(FlushFileBuffers(file.value), "OWNED_FILE_FLUSH_FAILED");
}
void WriteNewFile(const std::wstring& path, const std::string& data, Security& security) { WriteNewFile(path, data.data(), data.size(), security); }
void CopyArtifact(HANDLE source, const std::wstring& path, const std::string& expectedHash, Security& security) {
  Handle destination(CreateFileW(path.c_str(), GENERIC_WRITE | GENERIC_READ | READ_CONTROL, FILE_SHARE_READ,
    &security.attributes, CREATE_NEW, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
  Require(destination && SamePath(FinalPath(destination.value), path), "PACKAGE_DESTINATION_CONFLICT"); SeekStart(source);
  std::array<char, 65536> buffer{}; DWORD count = 0;
  do { Require(ReadFile(source, buffer.data(), static_cast<DWORD>(buffer.size()), &count, nullptr), "PACKAGE_READ_FAILED"); if (count) WriteAll(destination.value, buffer.data(), count); } while (count);
  Require(FlushFileBuffers(destination.value) && HashFile(destination.value) == expectedHash, "PACKAGE_COPY_MISMATCH"); CheckProtectedAcl(destination.value);
}
void WriteOwnership(const std::wstring& root, const std::string& installationId, const std::string& rootId,
  const Package& package, const std::string& phase, Security& security, bool first) {
  const auto path = Join(root, L"installation.json");
  std::string data = "{\"version\":" + QuoteJson(OwnershipVersion) + ",\"installationId\":" + QuoteJson(installationId)
    + ",\"rootIdentity\":" + QuoteJson(rootId) + ",\"packageManifestSha256\":" + QuoteJson(package.manifestHash)
    + ",\"serviceImagePath\":" + QuoteJson(Utf8(Join(root, L"bin\\authority-broker-host.exe")))
    + ",\"phase\":" + QuoteJson(phase) + ",\"files\":" + FilesJson(package.hashes) + '}';
  if (first) { WriteNewFile(path, data, security); return; }
  { auto old = OpenPath(path, false); CheckProtectedAcl(old.value, true);
    auto previous = JsonParser(ReadFileBounded(old.value, MaxFrame)).parse();
    Require(previous.at("installationId").string() == installationId && previous.at("rootIdentity").string() == rootId, "OWNERSHIP_MISMATCH"); }
  const auto temporary = Join(root, L"installation-" + Wide(installationId) + L".tmp");
  WriteNewFile(temporary, data, security);
  Require(MoveFileExW(temporary.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH), "OWNERSHIP_UPDATE_FAILED");
}
Json ReadOwnership(const std::wstring& root, const std::string& expectedId = {}, const std::string& expectedManifest = {}) {
  auto rootHandle = OpenPath(root, true, FILE_READ_ATTRIBUTES | READ_CONTROL, FILE_SHARE_READ | FILE_SHARE_WRITE); CheckProtectedAcl(rootHandle.value);
  auto file = OpenPath(Join(root, L"installation.json"), false); CheckProtectedAcl(file.value, true);
  auto value = JsonParser(ReadFileBounded(file.value, MaxFrame)).parse();
  value.exact({"version", "installationId", "rootIdentity", "packageManifestSha256", "serviceImagePath", "phase", "files"});
  Require(value.at("version").string() == OwnershipVersion && Hex(value.at("installationId").string(), 32)
    && Hex(value.at("packageManifestSha256").string(), 64) && value.at("rootIdentity").string() == RootIdentity(rootHandle.value)
    && SamePath(Wide(value.at("serviceImagePath").string()), Join(root, L"bin\\authority-broker-host.exe")), "OWNERSHIP_MISMATCH");
  if (!expectedId.empty()) Require(value.at("installationId").string() == expectedId, "INSTALLATION_ID_MISMATCH");
  if (!expectedManifest.empty()) Require(value.at("packageManifestSha256").string() == expectedManifest, "MANIFEST_PIN_MISMATCH");
  Require(value.at("phase").string() == "preparing" || value.at("phase").string() == "installed" || value.at("phase").string() == "rolled-back", "OWNERSHIP_PHASE_INVALID");
  return value;
}
std::map<std::string, std::string> OwnedHashes(const Json& ownership) {
  std::map<std::string, std::string> hashes; const auto& files = ownership.at("files");
  Require(files.kind == Json::Array && files.list.size() == PackageFiles.size(), "OWNERSHIP_FILES_INVALID");
  for (const auto& value : files.list) { value.exact({"path", "sha256"}); const auto& name = value.at("path").string(), hash = value.at("sha256").string();
    Require(std::find(PackageFiles.begin(), PackageFiles.end(), name) != PackageFiles.end() && Hex(hash, 64)
      && hashes.emplace(name, hash).second, "OWNERSHIP_FILES_INVALID"); }
  return hashes;
}
struct InstalledRuntime {
  std::wstring root, caller;
  Json bootstrap;
  std::vector<Handle> directories, code;
};
InstalledRuntime OpenInstalledRuntime(const std::wstring& root) {
  InstalledRuntime out; out.root = root; out.directories = HoldDirectories(Join(root, L"bin"));
  for (const auto& ancestor : out.directories) CheckAncestorAcl(ancestor.value);
  auto directory = OpenPath(root, true, FILE_READ_ATTRIBUTES | READ_CONTROL, FILE_SHARE_READ | FILE_SHARE_WRITE); CheckProtectedAcl(directory.value);
  auto bin = OpenPath(Join(root, L"bin"), true, FILE_READ_ATTRIBUTES | READ_CONTROL, FILE_SHARE_READ | FILE_SHARE_WRITE); CheckProtectedAcl(bin.value);
  auto ownership = ReadOwnership(root); Require(ownership.at("phase").string() == "installed", "INSTALLATION_INCOMPLETE"); auto hashes = OwnedHashes(ownership);
  for (const auto& name : PackageFiles) { auto relative = Wide(name); std::replace(relative.begin(), relative.end(), L'/', L'\\');
    auto file = OpenPath(Join(root, relative), false); CheckProtectedAcl(file.value);
    Require(HashFile(file.value) == hashes.at(name), "INSTALLED_CODE_MISMATCH"); out.code.push_back(std::move(file)); }
  auto bootstrap = OpenPath(Join(root, L"bootstrap.json"), false); CheckProtectedAcl(bootstrap.value, true);
  out.bootstrap = JsonParser(ReadFileBounded(bootstrap.value, MaxFrame)).parse();
  out.bootstrap.exact({"version", "installationId", "hostId", "currentUserSid", "programDataBasePath", "anchorIds"});
  Require(out.bootstrap.at("version").string() == BootstrapVersion
    && out.bootstrap.at("installationId").string() == ownership.at("installationId").string()
    && out.bootstrap.at("hostId").string() == "windows-authority-" + ownership.at("installationId").string()
    && SamePath(Wide(out.bootstrap.at("programDataBasePath").string()), ProgramData()), "BOOTSTRAP_BINDING_MISMATCH");
  CheckAnchorList(out.bootstrap.at("anchorIds")); out.caller = Wide(out.bootstrap.at("currentUserSid").string());
  Require(out.caller.rfind(L"S-1-5-21-", 0) == 0, "BOOTSTRAP_OPERATOR_INVALID"); Sid validCaller(out.caller);
  for (const auto* name : {L"integrity-key.dpapi", L"request-nonces.bin"}) { auto file = OpenPath(Join(root, name), false); CheckProtectedAcl(file.value, true); }
  return out;
}

std::string Base64(const std::vector<unsigned char>& value) {
  DWORD size = 0; Require(CryptBinaryToStringA(value.data(), static_cast<DWORD>(value.size()), CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF, nullptr, &size), "BASE64_UNAVAILABLE");
  std::string out(size, '\0'); Require(CryptBinaryToStringA(value.data(), static_cast<DWORD>(value.size()), CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF, out.data(), &size), "BASE64_UNAVAILABLE");
  while (!out.empty() && out.back() == '\0') out.pop_back(); return out;
}
RegHandle CreateRegistryCheckpoint(HKEY parent, const wchar_t* name, const std::string& json, Security& security, HANDLE caller) {
  RegHandle key; DWORD disposition = 0;
  Require(RegCreateKeyExW(parent, name, 0, nullptr, REG_OPTION_NON_VOLATILE,
    KEY_READ | KEY_WRITE | WRITE_DAC | READ_CONTROL | KEY_WOW64_64KEY, &security.attributes, &key.value, &disposition) == ERROR_SUCCESS
    && disposition == REG_CREATED_NEW_KEY, "REGISTRY_TARGET_CONFLICT");
  CheckRegistryParent(key.value);
  if (!json.empty()) { const auto wide = Wide(json);
    Require(RegSetValueExW(key.value, L"Checkpoint", 0, REG_SZ, reinterpret_cast<const BYTE*>(wide.c_str()),
      static_cast<DWORD>((wide.size() + 1) * sizeof(wchar_t))) == ERROR_SUCCESS, "REGISTRY_WRITE_FAILED");
    DWORD type = 0, bytes = 0; Require(RegQueryValueExW(key.value, L"Checkpoint", nullptr, &type, nullptr, &bytes) == ERROR_SUCCESS
      && type == REG_SZ && bytes == (wide.size() + 1) * sizeof(wchar_t), "REGISTRY_READBACK_FAILED");
    std::vector<wchar_t> readback(wide.size() + 1); Require(RegQueryValueExW(key.value, L"Checkpoint", nullptr, &type,
      reinterpret_cast<BYTE*>(readback.data()), &bytes) == ERROR_SUCCESS && readback.back() == L'\0'
      && std::wstring(readback.data(), wide.size()) == wide, "REGISTRY_READBACK_FAILED"); }
  DWORD needed = 0; Require(RegGetKeySecurity(key.value, OWNER_SECURITY_INFORMATION | GROUP_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
    nullptr, &needed) == ERROR_INSUFFICIENT_BUFFER && needed <= MaxFrame, "REGISTRY_ACL_UNAVAILABLE");
  std::vector<unsigned char> storage(needed); auto descriptor = reinterpret_cast<PSECURITY_DESCRIPTOR>(storage.data());
  Require(RegGetKeySecurity(key.value, OWNER_SECURITY_INFORMATION | GROUP_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION, descriptor, &needed) == ERROR_SUCCESS, "REGISTRY_ACL_UNAVAILABLE");
  DWORD access = AccessMask(descriptor, caller, true);
  Require((access & KEY_QUERY_VALUE) && !(access & (KEY_SET_VALUE | KEY_CREATE_SUB_KEY | KEY_CREATE_LINK | DELETE | WRITE_DAC | WRITE_OWNER)), "REGISTRY_OPERATOR_ACCESS_REJECTED");
  Require(RegFlushKey(key.value) == ERROR_SUCCESS, "REGISTRY_FLUSH_FAILED");
  return key;
}
void Install(Package& package, const std::wstring& base, Operator& caller) {
  Require(caller.elevated, "EXPLICIT_ELEVATION_REQUIRED"); const auto root = AuthorityRoot(base);
  ScHandle manager(OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CONNECT | SC_MANAGER_CREATE_SERVICE)); Require(manager.value != nullptr, "SCM_UNAVAILABLE");
  std::unique_ptr<ScHandle> existing(OpenServiceRead(manager.value)); Require(!existing && !PathExists(root) && !RegistryExists(), "INSTALLATION_CONFLICT");
  auto registryParents = OpenRegistryParents(true);
  Security readable(ObjectAcl(caller.sid, false)), privateState(ObjectAcl(caller.sid, true)), registry(ObjectAcl(caller.sid, false, true));
  DWORD wouldGrant = AccessMask(readable.attributes.lpSecurityDescriptor, caller.probe.value);
  Require((wouldGrant & FILE_READ_DATA) && !(wouldGrant & (FILE_GENERIC_WRITE | DELETE | WRITE_DAC | WRITE_OWNER | FILE_DELETE_CHILD) &
    ~(READ_CONTROL | SYNCHRONIZE)), "OPERATOR_TOKEN_NOT_RESTRICTED");
  const auto parent = Join(base, L"UnifiedAISystem");
  auto baseParents = HoldDirectories(base); for (const auto& ancestor : baseParents) CheckAncestorAcl(ancestor.value);
  if (!PathExists(parent)) CreateOwnedDirectory(parent, readable);
  auto parents = HoldDirectories(parent); for (const auto& ancestor : parents) CheckAncestorAcl(ancestor.value); CheckProtectedAcl(parents.back().value);
  CreateOwnedDirectory(root, readable); auto rootHandle = OpenPath(root, true, FILE_READ_ATTRIBUTES | READ_CONTROL, FILE_SHARE_READ | FILE_SHARE_WRITE);
  const auto installationId = RandomId(), identity = RootIdentity(rootHandle.value), hostId = "windows-authority-" + installationId;
  WriteOwnership(root, installationId, identity, package, "preparing", privateState, true);
  CreateOwnedDirectory(Join(root, L"bin"), readable); CreateOwnedDirectory(Join(root, L"licenses"), readable);
  CreateOwnedDirectory(Join(root, L"scratch"), privateState);
  for (size_t i = 0; i < PackageFiles.size(); ++i) { auto relative = Wide(PackageFiles[i]); std::replace(relative.begin(), relative.end(), L'/', L'\\');
    CopyArtifact(package.files[i].value, Join(root, relative), package.hashes.at(PackageFiles[i]), readable); }
  Secret key(32); Require(BCryptGenRandom(nullptr, key.bytes.data(), static_cast<ULONG>(key.bytes.size()), BCRYPT_USE_SYSTEM_PREFERRED_RNG) == 0, "RANDOM_UNAVAILABLE");
  DATA_BLOB plaintext{static_cast<DWORD>(key.bytes.size()), key.bytes.data()}, encrypted{};
  Require(CryptProtectData(&plaintext, L"Unified AI dedicated authority key", nullptr, nullptr, nullptr,
    CRYPTPROTECT_LOCAL_MACHINE | CRYPTPROTECT_UI_FORBIDDEN, &encrypted), "DPAPI_PROTECTION_FAILED"); LocalMemory encryptedMemory; encryptedMemory.value = encrypted.pbData;
  WriteNewFile(Join(root, L"integrity-key.dpapi"), reinterpret_cast<const char*>(encrypted.pbData), encrypted.cbData, privateState);
  const auto bootstrap = "{\"version\":" + QuoteJson(BootstrapVersion) + ",\"installationId\":" + QuoteJson(installationId)
    + ",\"hostId\":" + QuoteJson(hostId) + ",\"currentUserSid\":" + QuoteJson(Utf8(caller.sid))
    + ",\"programDataBasePath\":" + QuoteJson(Utf8(base)) + ",\"anchorIds\":" + AnchorsJson() + '}';
  WriteNewFile(Join(root, L"bootstrap.json"), bootstrap, privateState);
  WriteNewFile(Join(root, L"request-nonces.bin"), std::string(NonceHeader), privateState);
  PrivateText encoded; encoded.value = Base64(key.bytes);
  PrivateText helperInput; helperInput.value = "{\"hostId\":" + QuoteJson(hostId) + ",\"currentUserSid\":" + QuoteJson(Utf8(caller.sid))
    + ",\"programDataBasePath\":" + QuoteJson(Utf8(base)) + ",\"anchorIds\":" + AnchorsJson() + ",\"integrityKey\":" + QuoteJson(encoded.value) + '}';
  auto signedData = JsonParser(RunWorker(root, L"authority-install.mjs", [&](HANDLE) { return helperInput.value; }, nullptr, nullptr, L"--prepare-bootstrap")).parse();
  signedData.exact({"checkpoints"}); const auto& checkpoints = signedData.at("checkpoints"); Require(checkpoints.kind == Json::Array && checkpoints.list.size() == AnchorIds.size(), "SIGNER_REPLY_INVALID");
  std::map<std::string, std::string> signedCheckpoints;
  for (const auto& value : checkpoints.list) {
    value.exact({"anchorId", "checkpointJson"}); const auto& id = value.at("anchorId").string(), raw = value.at("checkpointJson").string();
    Require(std::find(AnchorIds.begin(), AnchorIds.end(), id) != AnchorIds.end() && raw.size() <= MaxFrame && signedCheckpoints.emplace(id, raw).second, "SIGNER_REPLY_INVALID");
    auto checkpoint = JsonParser(raw).parse(); checkpoint.exact({"fileVersion", "hostId", "serviceSid", "anchorPath", "hklmKeyPath", "hklmView",
      "currentGeneration", "currentDigest", "pendingGeneration", "pendingDigest", "hmacSha256"});
    Require(checkpoint.at("fileVersion").string() == "local-client-windows-authority-file-v1" && checkpoint.at("hostId").string() == hostId
      && checkpoint.at("serviceSid").string() == Utf8(ServiceSid) && checkpoint.at("hklmView").string() == "registry64"
      && checkpoint.at("anchorPath").string() == Utf8(Join(root, L"anchors\\" + Wide(id) + L"\\authority.json"))
      && checkpoint.at("hklmKeyPath").string() == Utf8(L"HKLM\\" + std::wstring(RegistryRoot) + L"\\Anchors\\" + Wide(id))
      && checkpoint.at("currentGeneration").kind == Json::Number && checkpoint.at("currentGeneration").text == "0"
      && checkpoint.at("currentDigest").kind == Json::Null && checkpoint.at("pendingGeneration").kind == Json::Null
      && checkpoint.at("pendingDigest").kind == Json::Null && Hex(checkpoint.at("hmacSha256").string(), 64), "SIGNER_BINDING_MISMATCH");
  }
  CreateOwnedDirectory(Join(root, L"anchors"), readable);
  if (!registryParents.product.value) registryParents.product = CreateRegistryCheckpoint(registryParents.software.value, L"UnifiedAISystem", {}, registry, caller.probe.value);
  auto authorityKey = CreateRegistryCheckpoint(registryParents.product.value, L"LocalClientAuthority", {}, registry, caller.probe.value);
  auto anchorsKey = CreateRegistryCheckpoint(authorityKey.value, L"Anchors", {}, registry, caller.probe.value);
  for (const auto& id : AnchorIds) {
    auto directory = Join(root, L"anchors\\" + Wide(id)); CreateOwnedDirectory(directory, readable);
    WriteNewFile(Join(directory, L"authority.json"), signedCheckpoints.at(id), readable);
    auto anchorKey = CreateRegistryCheckpoint(anchorsKey.value, Wide(id).c_str(),
      "{\"currentGeneration\":0,\"currentDigest\":null,\"pendingGeneration\":null,\"pendingDigest\":null}", registry, caller.probe.value);
    auto file = OpenPath(Join(directory, L"authority.json"), false); CheckProtectedAcl(file.value); VerifyOperatorFileAccess(file.value, caller.probe.value, true);
  }
  for (const auto* name : {L"installation.json", L"bootstrap.json", L"integrity-key.dpapi", L"request-nonces.bin"}) {
    auto file = OpenPath(Join(root, name), false); CheckProtectedAcl(file.value, true); VerifyOperatorFileAccess(file.value, caller.probe.value, false); }
  ScHandle service(CreateServiceW(manager.value, ServiceName, ServiceName, SERVICE_QUERY_CONFIG | SERVICE_QUERY_STATUS | SERVICE_CHANGE_CONFIG,
    SERVICE_WIN32_OWN_PROCESS, SERVICE_DEMAND_START, SERVICE_ERROR_NORMAL, ServiceCommand(root).c_str(), nullptr, nullptr, nullptr, ServiceAccount, nullptr));
  Require(service.value != nullptr, "SERVICE_CREATE_CONFLICT"); SERVICE_SID_INFO sid{SERVICE_SID_TYPE_UNRESTRICTED};
  Require(ChangeServiceConfig2W(service.value, SERVICE_CONFIG_SERVICE_SID_INFO, &sid), "SERVICE_SID_CONFIGURATION_FAILED"); CheckServiceConfiguration(service.value, root);
  WriteOwnership(root, installationId, identity, package, "installed", privateState, false);
  std::cout << "{\"mode\":\"apply\",\"serviceRegistered\":true,\"serviceStarted\":false,\"installationId\":" << QuoteJson(installationId)
    << ",\"manifestSha256\":" << QuoteJson(package.manifestHash) << ",\"nativeProvisioningVerified\":false}\n";
}

void Rollback(Package& package, const std::wstring& base, Operator& caller, const std::string& expectedId, bool apply) {
  const auto root = AuthorityRoot(base); auto parents = HoldDirectories(root); for (const auto& ancestor : parents) CheckAncestorAcl(ancestor.value);
  auto ownership = ReadOwnership(root, expectedId, package.manifestHash);
  auto hashes = OwnedHashes(ownership); Require(hashes == package.hashes, "OWNERSHIP_PACKAGE_MISMATCH");
  Require(!SamePath(ModulePath(), Join(root, L"bin\\authority-broker-host.exe")), "ROLLBACK_REQUIRES_EXTERNAL_PACKAGE");
  std::vector<std::wstring> present;
  for (const auto* subdirectory : {L"bin", L"licenses"}) {
    const auto directory = Join(root, subdirectory); if (!PathExists(directory)) continue;
    auto directoryGuard = OpenPath(directory, true, FILE_READ_ATTRIBUTES | READ_CONTROL, FILE_SHARE_READ | FILE_SHARE_WRITE); CheckProtectedAcl(directoryGuard.value);
    WIN32_FIND_DATAW found{}; HANDLE search = FindFirstFileW(Join(directory, L"*").c_str(), &found);
    if (search != INVALID_HANDLE_VALUE) {
      bool valid = true; do { std::wstring name(found.cFileName); if (name == L"." || name == L"..") continue;
        const auto relative = Utf8(subdirectory) + '/' + Utf8(name); if ((found.dwFileAttributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT)) || !hashes.count(relative)) { valid = false; break; }
      } while (FindNextFileW(search, &found)); FindClose(search); Require(valid, "ROLLBACK_UNOWNED_CODE_CONFLICT");
    } else Require(GetLastError() == ERROR_FILE_NOT_FOUND, "ROLLBACK_ENUMERATION_FAILED");
  }
  for (const auto& name : PackageFiles) { auto relative = Wide(name); std::replace(relative.begin(), relative.end(), L'/', L'\\'); auto path = Join(root, relative);
    if (PathExists(path)) { auto file = OpenPath(path, false); CheckProtectedAcl(file.value);
      Require(HashFile(file.value) == hashes.at(name), "ROLLBACK_CODE_MISMATCH"); present.push_back(path); } }
  ScHandle manager(OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CONNECT)); Require(manager.value != nullptr, "SCM_UNAVAILABLE");
  std::unique_ptr<ScHandle> queried(OpenServiceRead(manager.value));
  if (queried) CheckServiceConfiguration(queried->value, root, ownership.at("phase").string() == "preparing");
  if (!apply) { std::cout << "{\"mode\":\"rollback-check-only\",\"ownershipVerified\":true,\"statePreserved\":true,\"requiresExplicitApply\":true,\"systemMutations\":0}\n"; return; }
  Require(caller.elevated, "EXPLICIT_ELEVATION_REQUIRED");
  if (queried) {
    ScHandle service(OpenServiceW(manager.value, ServiceName, SERVICE_QUERY_CONFIG | SERVICE_QUERY_STATUS | SERVICE_STOP | DELETE)); Require(service.value != nullptr, "SERVICE_ROLLBACK_UNAVAILABLE");
    CheckServiceConfiguration(service.value, root, ownership.at("phase").string() == "preparing"); SERVICE_STATUS status{};
    if (!ControlService(service.value, SERVICE_CONTROL_STOP, &status)) Require(GetLastError() == ERROR_SERVICE_NOT_ACTIVE, "SERVICE_STOP_FAILED");
    ULONGLONG deadline = GetTickCount64() + 10000; SERVICE_STATUS_PROCESS actual{}; DWORD needed = 0;
    do { Require(QueryServiceStatusEx(service.value, SC_STATUS_PROCESS_INFO, reinterpret_cast<BYTE*>(&actual), sizeof(actual), &needed), "SERVICE_STATUS_UNAVAILABLE");
      if (actual.dwCurrentState == SERVICE_STOPPED) break; Require(Remaining(deadline) != 0, "SERVICE_STOP_TIMEOUT"); Sleep(20);
    } while (true);
    Require(DeleteService(service.value), "SERVICE_DELETE_FAILED");
  }
  for (const auto& path : present) { auto file = OpenPath(path, false, GENERIC_READ | DELETE | READ_CONTROL, FILE_SHARE_READ); CheckProtectedAcl(file.value);
    auto relative = Utf8(path.substr(root.size() + 1)); std::replace(relative.begin(), relative.end(), '\\', '/');
    Require(HashFile(file.value) == hashes.at(relative), "ROLLBACK_CODE_MISMATCH");
    FILE_DISPOSITION_INFO disposition{TRUE}; Require(SetFileInformationByHandle(file.value, FileDispositionInfo, &disposition, sizeof(disposition)), "ROLLBACK_CODE_REMOVE_FAILED"); }
  // Authority, DPAPI/bootstrap, nonce history, ownership and any partial state
  // are deliberately retained. A future reinstall cannot silently reset them.
  Security privateState(ObjectAcl(caller.sid, true));
  WriteOwnership(root, ownership.at("installationId").string(), ownership.at("rootIdentity").string(), package, "rolled-back", privateState, false);
  std::cout << "{\"mode\":\"rollback\",\"codeRemoved\":true,\"statePreserved\":true,\"nativeProvisioningVerified\":false}\n";
}

Handle StopEvent;
SERVICE_STATUS_HANDLE ServiceStatusHandle = nullptr;
SERVICE_STATUS Status{};
std::mutex StatusMutex;
void PublishStatus(DWORD state, DWORD error = NO_ERROR) {
  std::lock_guard<std::mutex> lock(StatusMutex);
  Status.dwServiceType = SERVICE_WIN32_OWN_PROCESS; Status.dwCurrentState = state; Status.dwWin32ExitCode = error;
  Status.dwControlsAccepted = state == SERVICE_RUNNING ? SERVICE_ACCEPT_STOP | SERVICE_ACCEPT_SHUTDOWN : 0;
  Status.dwWaitHint = state == SERVICE_START_PENDING || state == SERVICE_STOP_PENDING ? RequestDeadlineMs + 2000 : 0;
  Status.dwCheckPoint = Status.dwWaitHint ? Status.dwCheckPoint + 1 : 0; if (ServiceStatusHandle) SetServiceStatus(ServiceStatusHandle, &Status);
}
DWORD WINAPI ServiceControl(DWORD control, DWORD, void*, void*) {
  if (control == SERVICE_CONTROL_STOP || control == SERVICE_CONTROL_SHUTDOWN) {
    if (!StopEvent) return ERROR_SERVICE_CANNOT_ACCEPT_CTRL;
    PublishStatus(SERVICE_STOP_PENDING); SetEvent(StopEvent.value); return NO_ERROR;
  }
  return control == SERVICE_CONTROL_INTERROGATE ? NO_ERROR : ERROR_CALL_NOT_IMPLEMENTED;
}
void PipeTransfer(HANDLE pipe, void* bytes, size_t size, bool writing, ULONGLONG deadline) {
  size_t offset = 0;
  while (offset < size) {
    Handle event(CreateEventW(nullptr, TRUE, FALSE, nullptr)); Require(static_cast<bool>(event), "PIPE_EVENT_UNAVAILABLE"); OVERLAPPED operation{}; operation.hEvent = event.value;
    DWORD count = 0; BOOL ready = writing ? WriteFile(pipe, static_cast<char*>(bytes) + offset, static_cast<DWORD>(size - offset), &count, &operation)
      : ReadFile(pipe, static_cast<char*>(bytes) + offset, static_cast<DWORD>(size - offset), &count, &operation);
    if (!ready) {
      Require(GetLastError() == ERROR_IO_PENDING, "PIPE_DISCONNECTED"); HANDLE waits[] = {StopEvent.value, event.value};
      DWORD state = WaitForMultipleObjects(2, waits, FALSE, Remaining(deadline));
      if (state != WAIT_OBJECT_0 + 1) { CancelIoEx(pipe, &operation); GetOverlappedResult(pipe, &operation, &count, TRUE); Reject("PIPE_DEADLINE"); }
      Require(GetOverlappedResult(pipe, &operation, &count, FALSE), "PIPE_DISCONNECTED");
    }
    Require(count != 0 && Remaining(deadline) != 0, "PIPE_DEADLINE"); offset += count;
  }
}
Handle AuthenticatePipeCaller(HANDLE pipe, const std::wstring& expectedSid) {
  Require(ImpersonateNamedPipeClient(pipe), "CALLER_IMPERSONATION_FAILED"); Handle token;
  BOOL opened = OpenThreadToken(GetCurrentThread(), TOKEN_QUERY | TOKEN_DUPLICATE, TRUE, &token.value);
  BOOL reverted = RevertToSelf(); Require(opened && reverted, "CALLER_TOKEN_UNAVAILABLE");
  TOKEN_TYPE type{}; SECURITY_IMPERSONATION_LEVEL level{}; DWORD bytes = 0;
  Require(GetTokenInformation(token.value, TokenType, &type, sizeof(type), &bytes) && type == TokenImpersonation
    && GetTokenInformation(token.value, TokenImpersonationLevel, &level, sizeof(level), &bytes) && level >= SecurityImpersonation
    && TokenUserSid(token.value) == expectedSid, "CALLER_IDENTITY_REJECTED");
  Handle duplicate; Require(DuplicateTokenEx(token.value, TOKEN_QUERY, nullptr, SecurityImpersonation, TokenImpersonation, &duplicate.value), "CALLER_DUPLICATION_FAILED"); return duplicate;
}
void ServeConnection(HANDLE pipe, const InstalledRuntime& runtime) {
  ULONGLONG deadline = GetTickCount64() + RequestDeadlineMs; std::array<unsigned char, 4> length{};
  PipeTransfer(pipe, length.data(), length.size(), false, deadline);
  const uint32_t size = static_cast<uint32_t>(length[0]) | (static_cast<uint32_t>(length[1]) << 8)
    | (static_cast<uint32_t>(length[2]) << 16) | (static_cast<uint32_t>(length[3]) << 24);
  Require(size && size <= MaxFrame, "PIPE_FRAME_INVALID"); PrivateText request; request.value.resize(size);
  PipeTransfer(pipe, request.value.data(), request.value.size(), false, deadline); Require(JsonParser(request.value).parse().kind == Json::Object, "PIPE_REQUEST_INVALID");
  auto caller = AuthenticatePipeCaller(pipe, runtime.caller); Require(PeerConnected(pipe), "PIPE_TRAILING_DATA"); auto id = RandomId();
  auto raw = RunWorker(runtime.root, L"authority-worker.mjs", [&](HANDLE child) {
    HANDLE duplicated = nullptr; Require(DuplicateHandle(GetCurrentProcess(), caller.value, child, &duplicated, TOKEN_QUERY, FALSE, 0), "CALLER_TRANSFER_FAILED");
    return "{\"id\":" + QuoteJson(id) + ",\"callerTokenHandle\":" + QuoteJson(std::to_string(reinterpret_cast<uintptr_t>(duplicated)))
      + ",\"request\":" + QuoteJson(request.value) + '}';
  }, StopEvent.value, pipe, nullptr, deadline);
  auto envelope = JsonParser(raw).parse();
  if (envelope.kind == Json::Object && envelope.members.count("workerError")) {
    envelope.exact({"workerError", "failureCode"});
    const auto& stage = envelope.at("workerError").string(); const auto& code = envelope.at("failureCode").string();
    const auto fixedCode = [](const std::string& value, size_t maximum) {
      return !value.empty() && value.size() <= maximum && std::all_of(value.begin(), value.end(), [](char c) {
        return (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_'; });
    };
    Require(fixedCode(stage, 64) && fixedCode(code, 128), "WORKER_FAILURE_FRAME_INVALID");
    const auto diagnostic = "WORKER_" + stage + '_' + code;
    Reject((diagnostic.size() <= 128 ? diagnostic : "WORKER_" + stage).c_str());
  }
  envelope.exact({"id", "response"});
  Require(envelope.at("id").string() == id, "WORKER_RESPONSE_BINDING_MISMATCH"); PrivateText response; response.value = envelope.at("response").string();
  Require(!response.value.empty() && response.value.size() <= MaxFrame && JsonParser(response.value).parse().kind == Json::Object, "WORKER_RESPONSE_INVALID");
  uint32_t responseSize = static_cast<uint32_t>(response.value.size()); for (size_t i = 0; i < length.size(); ++i) length[i] = static_cast<unsigned char>(responseSize >> (8 * i));
  PipeTransfer(pipe, length.data(), length.size(), true, deadline); PipeTransfer(pipe, response.value.data(), response.value.size(), true, deadline);
  // Disconnect discards unread data. Let the client finish its final server-PID
  // check and close first; a stalled peer, stop or extra input cannot extend the request.
  while (PeerConnected(pipe)) {
    const DWORD remaining = Remaining(deadline);
    Require(remaining && WaitForSingleObject(StopEvent.value, std::min<DWORD>(remaining, 10)) == WAIT_TIMEOUT,
      "PIPE_DELIVERY_DEADLINE");
  }
}
void SendConnectionFailure(HANDLE pipe, const char* message = nullptr) noexcept {
  try {
    size_t size = 0; if (message) while (size < 129 && message[size]) ++size;
    std::string code = "NATIVE_AUTHORITY_REQUEST_REJECTED";
    if (size && size <= 128 && std::all_of(message, message + size, [](char c) {
      return (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_'; })) code.assign(message, size);
    std::string reply = "{\"nativeError\":" + QuoteJson(code) + '}'; std::array<unsigned char, 4> prefix{};
    for (size_t i = 0; i < prefix.size(); ++i) prefix[i] = static_cast<unsigned char>(reply.size() >> (8 * i));
    if (WaitForSingleObject(StopEvent.value, 0) == WAIT_OBJECT_0) return;
    const ULONGLONG deadline = GetTickCount64() + 1000;
    PipeTransfer(pipe, prefix.data(), prefix.size(), true, deadline);
    if (WaitForSingleObject(StopEvent.value, 0) == WAIT_OBJECT_0) return;
    PipeTransfer(pipe, reply.data(), reply.size(), true, deadline);
    while (PeerConnected(pipe)) {
      const DWORD remaining = Remaining(deadline);
      if (!remaining || WaitForSingleObject(StopEvent.value, std::min<DWORD>(remaining, 10)) != WAIT_TIMEOUT) break;
    }
  } catch (...) { /* Failure reporting is bounded and must not prevent disconnect. */ }
}
void WINAPI ServiceMain(DWORD, LPWSTR*) {
  ServiceStatusHandle = RegisterServiceCtrlHandlerExW(ServiceName, ServiceControl, nullptr); if (!ServiceStatusHandle) return;
  StopEvent.reset(CreateEventW(nullptr, TRUE, FALSE, nullptr)); if (!StopEvent) { PublishStatus(SERVICE_STOPPED, ERROR_SERVICE_SPECIFIC_ERROR); return; }
  PublishStatus(SERVICE_START_PENDING);
  try {
    const auto root = AuthorityRoot(ProgramData()); Require(SamePath(ModulePath(), Join(root, L"bin\\authority-broker-host.exe")), "SERVICE_IMAGE_REJECTED");
    Handle token; Require(OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token.value) && TokenHasServiceSid(token.value), "SERVICE_TOKEN_REJECTED");
    auto runtime = OpenInstalledRuntime(root); ScHandle manager(OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CONNECT)); Require(manager.value != nullptr, "SCM_UNAVAILABLE");
    std::unique_ptr<ScHandle> service(OpenServiceRead(manager.value)); Require(static_cast<bool>(service), "SCM_BINDING_REJECTED"); CheckServiceConfiguration(service->value, root);
    SERVICE_STATUS_PROCESS actual{}; DWORD needed = 0;
    Require(QueryServiceStatusEx(service->value, SC_STATUS_PROCESS_INFO, reinterpret_cast<BYTE*>(&actual), sizeof(actual), &needed)
      && actual.dwProcessId == GetCurrentProcessId(), "SCM_PROCESS_BINDING_REJECTED");
    // The bound, non-elevated caller must query this process's image to verify
    // the actual SCM/pipe server PID. Its ACE grants only query-limited (0x1000),
    // without memory, handle-duplication, termination or DACL-changing access.
    // runtime.caller came from the verified protected installation, not a request.
    static_assert(PROCESS_QUERY_LIMITED_INFORMATION == 0x1000);
    Security processSecurity(L"D:P(A;;GA;;;SY)(A;;GA;;;BA)(A;;GA;;;" + std::wstring(ServiceSid)
      + L")(A;;0x1000;;;" + runtime.caller + L")");
    PACL processDacl = nullptr; BOOL daclPresent = FALSE, daclDefaulted = FALSE;
    Require(GetSecurityDescriptorDacl(processSecurity.attributes.lpSecurityDescriptor, &daclPresent, &processDacl, &daclDefaulted)
      && daclPresent && processDacl && IsValidAcl(processDacl), "SERVICE_PROCESS_DACL_INVALID");
    Require(SetSecurityInfo(GetCurrentProcess(), SE_KERNEL_OBJECT, DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
      nullptr, nullptr, processDacl, nullptr) == ERROR_SUCCESS, "SERVICE_PROCESS_QUERY_ACCESS_FAILED");
    Security pipeSecurity(L"D:P(A;;GA;;;SY)(A;;GA;;;BA)(A;;GA;;;" + std::wstring(ServiceSid) + L")(A;;GRGW;;;" + runtime.caller + L")");
    Handle pipe(CreateNamedPipeW(PipeName, PIPE_ACCESS_DUPLEX | FILE_FLAG_OVERLAPPED | FILE_FLAG_FIRST_PIPE_INSTANCE,
      PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS, 1, static_cast<DWORD>(MaxFrame + 4),
      static_cast<DWORD>(MaxFrame + 4), RequestDeadlineMs, &pipeSecurity.attributes));
    Require(static_cast<bool>(pipe), "PIPE_OWNERSHIP_CONFLICT"); PublishStatus(SERVICE_RUNNING);
    while (WaitForSingleObject(StopEvent.value, 0) != WAIT_OBJECT_0) {
      Handle event(CreateEventW(nullptr, TRUE, FALSE, nullptr)); Require(static_cast<bool>(event), "PIPE_EVENT_UNAVAILABLE"); OVERLAPPED connection{}; connection.hEvent = event.value;
      BOOL connected = ConnectNamedPipe(pipe.value, &connection);
      if (!connected) {
        DWORD error = GetLastError();
        if (error == ERROR_PIPE_CONNECTED) SetEvent(event.value);
        else Require(error == ERROR_IO_PENDING, "PIPE_CONNECT_FAILED");
        HANDLE waits[] = {StopEvent.value, event.value}; DWORD state = WaitForMultipleObjects(2, waits, FALSE, INFINITE);
        if (state != WAIT_OBJECT_0 + 1) { CancelIoEx(pipe.value, &connection); DWORD ignored = 0; GetOverlappedResult(pipe.value, &connection, &ignored, TRUE); break; }
      }
      try { ServeConnection(pipe.value, runtime); }
      catch (const std::exception& error) { SendConnectionFailure(pipe.value, error.what()); }
      catch (...) { SendConnectionFailure(pipe.value); }
      DisconnectNamedPipe(pipe.value);
    }
    PublishStatus(SERVICE_STOPPED);
  } catch (...) { PublishStatus(SERVICE_STOPPED, ERROR_SERVICE_SPECIFIC_ERROR); }
}

struct Options {
  bool apply = false, yes = false, check = false, rollback = false;
  std::wstring package;
  std::string expectedHash, installationId;
};
Options ParseOptions(int argc, wchar_t** argv) {
  Options out; std::set<std::wstring> seen;
  for (int i = 1; i < argc; ++i) {
    std::wstring flag(argv[i]); Require(seen.insert(flag).second, "CLI_DUPLICATE_FLAG");
    if (flag == L"--apply") out.apply = true; else if (flag == L"--yes") out.yes = true;
    else if (flag == L"--check-only") out.check = true; else if (flag == L"--rollback") out.rollback = true;
    else if (flag == L"--package" || flag == L"--expected-manifest-sha256" || flag == L"--installation-id") {
      Require(++i < argc, "CLI_VALUE_REQUIRED"); if (flag == L"--package") out.package = FullPath(argv[i]);
      else if (flag == L"--expected-manifest-sha256") { out.expectedHash = Utf8(argv[i]); Require(Hex(out.expectedHash, 64), "CLI_MANIFEST_HASH_INVALID"); }
      else { out.installationId = Utf8(argv[i]); Require(Hex(out.installationId, 32), "CLI_INSTALLATION_ID_INVALID"); }
    } else Reject("CLI_FLAG_REJECTED");
  }
  Require(out.apply == out.yes && !(out.apply && out.check) && (!out.apply || !out.expectedHash.empty())
    && (!out.rollback || !out.installationId.empty()) && (out.rollback || out.installationId.empty()), "CLI_APPLY_GUARD_REQUIRED");
  if (out.package.empty()) { const auto parent = Parent(ModulePath()); out.package = SamePath(parent.substr(parent.find_last_of(L'\\') + 1), L"bin") ? Parent(parent) : parent; }
  return out;
}
} // namespace

int wmain(int argc, wchar_t** argv) {
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
  if (argc == 2 && std::wstring(argv[1]) == L"--service") {
    SERVICE_TABLE_ENTRYW table[] = {{const_cast<LPWSTR>(ServiceName), ServiceMain}, {nullptr, nullptr}};
    return StartServiceCtrlDispatcherW(table) ? 0 : 2;
  }
  bool readOnly = true;
  try {
    auto options = ParseOptions(argc, argv); readOnly = !options.apply;
    auto package = OpenPackage(options.package, options.expectedHash);
    const auto base = ProgramData(); auto caller = ReadOperator();
    if (options.rollback) Rollback(package, base, caller, options.installationId, options.apply);
    else if (options.apply) Install(package, base, caller);
    else {
      ScHandle manager(OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CONNECT)); Require(manager.value != nullptr, "SCM_UNAVAILABLE");
      std::unique_ptr<ScHandle> service(OpenServiceRead(manager.value)); const bool rootPresent = PathExists(AuthorityRoot(base)), registryPresent = RegistryExists();
      std::cout << "{\"mode\":\"check-only\",\"packageVerified\":true,\"manifestSha256\":" << QuoteJson(package.manifestHash)
        << ",\"manifestPinVerified\":" << (options.expectedHash.empty() ? "false" : "true")
        << ",\"servicePresent\":" << (service ? "true" : "false") << ",\"protectedRootPresent\":" << (rootPresent ? "true" : "false")
        << ",\"registryPresent\":" << (registryPresent ? "true" : "false") << ",\"conflict\":" << ((service || rootPresent || registryPresent) ? "true" : "false")
        << ",\"elevated\":" << (caller.elevated ? "true" : "false") << ",\"requiresExplicitApply\":true,\"systemMutations\":0,\"nativeProvisioningVerified\":false}\n";
    }
    return 0;
  } catch (const std::exception& error) {
    // All thrown messages are fixed error codes. No Windows error text, path,
    // SID, command line, token handle, request or secret is included.
    std::cerr << "{\"error\":" << QuoteJson(error.what()) << (readOnly ? ",\"systemMutations\":0" : "") << ",\"nativeProvisioningVerified\":false}\n"; return 2;
  } catch (...) { std::cerr << "{\"error\":\"NATIVE_AUTHORITY_REJECTED\"" << (readOnly ? ",\"systemMutations\":0" : "") << ",\"nativeProvisioningVerified\":false}\n"; return 2; }
}
