// Same-user process ownership only. This is neither an installer nor a filesystem sandbox.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <tlhelp32.h>
#include <sddl.h>
#include <array>
#include <cstdint>
#include <set>
#include <string>
#include <utility>
#include <vector>

namespace {
struct Handle {
  HANDLE value = nullptr;
  Handle() = default; explicit Handle(HANDLE v) : value(v) {}
  ~Handle() { reset(); }
  Handle(const Handle&) = delete; Handle& operator=(const Handle&) = delete;
  explicit operator bool() const { return value && value != INVALID_HANDLE_VALUE; }
  void reset(HANDLE v = nullptr) { if (*this) CloseHandle(value); value = v; }
};
struct Fault { const char* code; };
void Require(bool ok, const char* code) { if (!ok) throw Fault{code}; }
struct Options { DWORD parent = 0, timeout = 0, drain = 0; std::wstring eventName, executable, command; std::string hostCreated, childCreated; };
DWORD Number(const wchar_t* value) {
  uint64_t total = 0; Require(value && *value, "ARGUMENTS_INVALID");
  for (; *value; ++value) { Require(*value >= L'0' && *value <= L'9', "ARGUMENTS_INVALID"); total = total * 10 + static_cast<unsigned>(*value - L'0'); Require(total <= MAXDWORD, "ARGUMENTS_INVALID"); }
  return static_cast<DWORD>(total);
}
bool EventName(const std::wstring& value) {
  const std::wstring prefix = L"Local\\UaiNativeRun-";
  if (value.size() != prefix.size() + 36 || value.compare(0, prefix.size(), prefix)) return false;
  for (size_t i = 0; i < 36; ++i) { const wchar_t ch = value[prefix.size() + i];
    if (i == 8 || i == 13 || i == 18 || i == 23) { if (ch != L'-') return false; }
    else if (!((ch >= L'0' && ch <= L'9') || (ch >= L'a' && ch <= L'f') || (ch >= L'A' && ch <= L'F'))) return false;
  } return true;
}
std::wstring Quote(const std::wstring& value) {
  std::wstring out = L"\""; size_t slashes = 0;
  for (const auto ch : value) { if (ch == L'\\') { ++slashes; continue; }
    out.append(ch == L'"' ? slashes * 2 + 1 : slashes, L'\\'); out += ch; slashes = 0; }
  out.append(slashes * 2, L'\\'); return out + L'"';
}
void Parse(int argc, wchar_t** argv, Options& o) {
  std::set<std::wstring> seen; int i = 1;
  for (; i < argc && std::wstring(argv[i]) != L"--"; ++i) {
    const std::wstring flag = argv[i]; Require(seen.insert(flag).second && i + 1 < argc, "ARGUMENTS_INVALID"); const wchar_t* value = argv[++i];
    if (flag == L"--parent-pid") o.parent = Number(value);
    else if (flag == L"--timeout-ms") o.timeout = Number(value);
    else if (flag == L"--drain-ms") o.drain = Number(value);
    else if (flag == L"--cancel-event") o.eventName = value;
    else Require(false, "ARGUMENTS_INVALID");
  }
  Require(seen.size() == 4 && o.parent && EventName(o.eventName) && o.timeout >= 100 && o.timeout <= 3600000
    && o.drain >= 100 && o.drain <= 30000 && i + 1 < argc && argc - i <= 130, "ARGUMENTS_INVALID");
  o.executable = argv[++i]; Require(o.executable.size() > 6 && o.executable.size() <= 4096 && o.executable[1] == L':'
    && (o.executable[2] == L'\\' || o.executable[2] == L'/') && _wcsicmp(o.executable.c_str() + o.executable.size() - 4, L".exe") == 0, "EXECUTABLE_INVALID");
  const DWORD attrs = GetFileAttributesW(o.executable.c_str());
  Require(attrs != INVALID_FILE_ATTRIBUTES && !(attrs & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT)), "EXECUTABLE_INVALID");
  for (; i < argc; ++i) { const std::wstring arg = argv[i]; Require(arg.size() <= 16384 && arg.find_first_of(L"\r\n") == std::wstring::npos
      && arg.find(o.eventName) == std::wstring::npos, "CHILD_ARGUMENT_INVALID"); if (!o.command.empty()) o.command += L' '; o.command += Quote(arg); }
  Require(o.command.size() < 32760, "CHILD_ARGUMENT_INVALID");
  wchar_t* environment = GetEnvironmentStringsW(); Require(environment != nullptr, "ENVIRONMENT_UNAVAILABLE"); bool safe = true;
  for (const wchar_t* entry = environment; *entry; entry += wcslen(entry) + 1) if (std::wstring(entry).find(o.eventName) != std::wstring::npos) safe = false;
  FreeEnvironmentStringsW(environment); Require(safe, "EVENT_IN_CHILD_ENVIRONMENT");
}
DWORD ActualParent() {
  Handle snapshot(CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)); Require(static_cast<bool>(snapshot), "PARENT_QUERY_FAILED");
  PROCESSENTRY32W entry{}; entry.dwSize = sizeof(entry); Require(Process32FirstW(snapshot.value, &entry), "PARENT_QUERY_FAILED");
  do { if (entry.th32ProcessID == GetCurrentProcessId()) return entry.th32ParentProcessID; } while (Process32NextW(snapshot.value, &entry));
  throw Fault{"PARENT_QUERY_FAILED"};
}
FILETIME Created(HANDLE process) { FILETIME created{}, exited{}, kernel{}, user{}; Require(GetProcessTimes(process, &created, &exited, &kernel, &user), "PROCESS_TIME_UNAVAILABLE"); return created; }
std::string CreationString(const FILETIME& value) { ULARGE_INTEGER time{}; time.LowPart = value.dwLowDateTime; time.HighPart = value.dwHighDateTime; return std::to_string(time.QuadPart); }
HANDLE CancellationEvent(const std::wstring& name) {
  Handle token; Require(OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token.value), "USER_TOKEN_UNAVAILABLE"); DWORD size = 0;
  GetTokenInformation(token.value, TokenUser, nullptr, 0, &size); Require(size > 0 && size < 65536, "USER_SID_UNAVAILABLE");
  std::vector<BYTE> bytes(size); Require(GetTokenInformation(token.value, TokenUser, bytes.data(), size, &size), "USER_SID_UNAVAILABLE");
  LPWSTR rawSid = nullptr; Require(ConvertSidToStringSidW(reinterpret_cast<TOKEN_USER*>(bytes.data())->User.Sid, &rawSid), "USER_SID_UNAVAILABLE");
  const std::wstring sid(rawSid); LocalFree(rawSid);
  const std::wstring sddl = L"O:" + sid + L"G:" + sid + L"D:P(A;;GA;;;SY)(A;;GA;;;" + sid + L")";
  PSECURITY_DESCRIPTOR descriptor = nullptr; Require(ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl.c_str(), SDDL_REVISION_1, &descriptor, nullptr), "EVENT_SECURITY_FAILED");
  SECURITY_ATTRIBUTES attributes{sizeof(SECURITY_ATTRIBUTES), descriptor, FALSE}; SetLastError(ERROR_SUCCESS);
  HANDLE event = CreateEventW(&attributes, TRUE, FALSE, name.c_str()); const DWORD error = GetLastError(); LocalFree(descriptor);
  if (error == ERROR_ALREADY_EXISTS) { if (event) CloseHandle(event); throw Fault{"EVENT_ALREADY_EXISTS"}; }
  Require(event != nullptr, "EVENT_CREATE_FAILED"); return event;
}
std::string SafeEvent(const std::wstring& value) { if (!EventName(value)) return ""; std::string out;
  for (const auto ch : value) { if (ch == L'\\') out += '\\'; out += static_cast<char>(ch); } return out; }
bool Control(const Options& o, DWORD child, const std::string& fields) {
  const auto frame = "[uai-native-job] {\"protocol\":\"uai-native-job-v1\",\"eventName\":\"" + SafeEvent(o.eventName)
    + "\",\"hostPid\":" + std::to_string(GetCurrentProcessId()) + ",\"childPid\":" + (child ? std::to_string(child) : "null")
    + ",\"parentPid\":" + std::to_string(o.parent) + ",\"hostCreated\":" + (o.hostCreated.empty() ? "null" : "\"" + o.hostCreated + "\"")
    + ",\"childCreated\":" + (o.childCreated.empty() ? "null" : "\"" + o.childCreated + "\"") + "," + fields + "}\n";
  DWORD written = 0; return WriteFile(GetStdHandle(STD_ERROR_HANDLE), frame.data(), static_cast<DWORD>(frame.size()), &written, nullptr) && written == frame.size();
}
bool ActiveProcesses(HANDLE job, DWORD& active) { JOBOBJECT_BASIC_ACCOUNTING_INFORMATION info{};
  if (!QueryInformationJobObject(job, JobObjectBasicAccountingInformation, &info, sizeof(info), nullptr)) return false; active = info.ActiveProcesses; return true; }
bool Drain(HANDLE job, HANDLE child, DWORD milliseconds, DWORD& active) {
  const ULONGLONG end = GetTickCount64() + milliseconds;
  do { if (!ActiveProcesses(job, active)) return false; if (active == 0 && WaitForSingleObject(child, 0) == WAIT_OBJECT_0) return true; Sleep(10); } while (GetTickCount64() < end);
  return ActiveProcesses(job, active) && active == 0 && WaitForSingleObject(child, 0) == WAIT_OBJECT_0;
}
}

int wmain(int argc, wchar_t** argv) {
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
  Options options; Handle parent, cancel, job, process, thread; std::array<Handle, 3> stdio;
  LPPROC_THREAD_ATTRIBUTE_LIST attributes = nullptr; std::vector<BYTE> attributeBytes; DWORD childPid = 0, childExit = 0, active = 0;
  bool assigned = false, attributesReady = false, quiescent = true, exitKnown = false, activeKnown = true; const ULONGLONG began = GetTickCount64();
  std::string status = "failed", code = "INTERNAL_FAILURE";
  try {
    const FILETIME hostCreated = Created(GetCurrentProcess()); options.hostCreated = CreationString(hostCreated); Parse(argc, argv, options);
    Require(ActualParent() == options.parent, "PARENT_PID_MISMATCH");
    parent.reset(OpenProcess(SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, FALSE, options.parent)); Require(static_cast<bool>(parent), "PARENT_UNAVAILABLE");
    const FILETIME parentCreated = Created(parent.value); Require(CompareFileTime(&parentCreated, &hostCreated) <= 0 && WaitForSingleObject(parent.value, 0) == WAIT_TIMEOUT, "PARENT_IDENTITY_EXPIRED");
    cancel.reset(CancellationEvent(options.eventName)); job.reset(CreateJobObjectW(nullptr, nullptr)); Require(static_cast<bool>(job), "JOB_CREATE_FAILED");
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{}; limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION;
    Require(SetInformationJobObject(job.value, JobObjectExtendedLimitInformation, &limits, sizeof(limits)), "JOB_LIMITS_FAILED");
    const std::array<DWORD, 3> kinds{STD_INPUT_HANDLE, STD_OUTPUT_HANDLE, STD_ERROR_HANDLE}; std::array<HANDLE, 3> inherited{};
    for (size_t i = 0; i < kinds.size(); ++i) { Require(DuplicateHandle(GetCurrentProcess(), GetStdHandle(kinds[i]), GetCurrentProcess(), &stdio[i].value, 0, TRUE, DUPLICATE_SAME_ACCESS), "STDIO_DUPLICATION_FAILED"); inherited[i] = stdio[i].value; }
    SIZE_T size = 0; InitializeProcThreadAttributeList(nullptr, 1, 0, &size); attributeBytes.resize(size); attributes = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(attributeBytes.data());
    Require(InitializeProcThreadAttributeList(attributes, 1, 0, &size), "PROCESS_ATTRIBUTES_FAILED"); attributesReady = true;
    Require(UpdateProcThreadAttribute(attributes, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST, inherited.data(), sizeof(inherited), nullptr, nullptr), "HANDLE_LIST_FAILED");
    STARTUPINFOEXW startup{}; startup.StartupInfo.cb = sizeof(startup); startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
    startup.StartupInfo.hStdInput = inherited[0]; startup.StartupInfo.hStdOutput = inherited[1]; startup.StartupInfo.hStdError = inherited[2]; startup.lpAttributeList = attributes;
    PROCESS_INFORMATION created{}; Require(CreateProcessW(options.executable.c_str(), options.command.data(), nullptr, nullptr, TRUE,
      CREATE_SUSPENDED | CREATE_NO_WINDOW | CREATE_UNICODE_ENVIRONMENT | EXTENDED_STARTUPINFO_PRESENT, nullptr, nullptr, &startup.StartupInfo, &created), "CHILD_CREATE_FAILED");
    process.reset(created.hProcess); thread.reset(created.hThread); childPid = created.dwProcessId; quiescent = false;
    options.childCreated = CreationString(Created(process.value));
    Require(AssignProcessToJobObject(job.value, process.value), "JOB_ASSIGN_FAILED"); assigned = true;
    Require(Control(options, childPid, "\"event\":\"started\",\"killOnClose\":true"), "START_CONTROL_WRITE_FAILED");
    const ULONGLONG elapsed = GetTickCount64() - began; DWORD state;
    if (WaitForSingleObject(parent.value, 0) == WAIT_OBJECT_0) state = WAIT_OBJECT_0 + 2;
    else if (WaitForSingleObject(cancel.value, 0) == WAIT_OBJECT_0) state = WAIT_OBJECT_0 + 1;
    else if (elapsed >= options.timeout) state = WAIT_TIMEOUT;
    else {
      Require(ResumeThread(thread.value) != static_cast<DWORD>(-1), "CHILD_RESUME_FAILED"); thread.reset(); for (auto& handle : stdio) handle.reset();
      const std::array<HANDLE, 3> waits{process.value, cancel.value, parent.value};
      state = WaitForMultipleObjects(static_cast<DWORD>(waits.size()), waits.data(), FALSE, options.timeout - static_cast<DWORD>(elapsed));
    }
    if (state == WAIT_OBJECT_0) { status = "exited"; code = "OK"; }
    else if (state == WAIT_OBJECT_0 + 1) { status = "cancelled"; code = "CANCELLED"; }
    else if (state == WAIT_OBJECT_0 + 2) { status = "parent-exited"; code = "PARENT_EXITED"; }
    else if (state == WAIT_TIMEOUT) { status = "timeout"; code = "TIMEOUT"; }
    else throw Fault{"PROCESS_WAIT_FAILED"};
  } catch (const Fault& error) { code = error.code; } catch (...) { code = "INTERNAL_FAILURE"; }
  if (process) {
    if (assigned) { TerminateJobObject(job.value, ERROR_CANCELLED); quiescent = Drain(job.value, process.value, options.drain ? options.drain : 1000, active); activeKnown = ActiveProcesses(job.value, active); }
    else { TerminateProcess(process.value, ERROR_CANCELLED); quiescent = WaitForSingleObject(process.value, options.drain ? options.drain : 1000) == WAIT_OBJECT_0; active = 0; }
    exitKnown = WaitForSingleObject(process.value, 0) == WAIT_OBJECT_0 && GetExitCodeProcess(process.value, &childExit);
    if (!quiescent) { status = "failed"; code = "DRAIN_UNCONFIRMED"; }
  }
  if (attributesReady) DeleteProcThreadAttributeList(attributes);
  Control(options, childPid, "\"event\":\"completed\",\"status\":\"" + status + "\",\"childExitCode\":" + (exitKnown ? std::to_string(childExit) : "null")
    + ",\"quiescent\":" + (quiescent ? "true" : "false") + ",\"activeProcesses\":" + (activeKnown ? std::to_string(active) : "null") + ",\"code\":\"" + code + "\"");
  if (!quiescent || status == "failed") return 125;
  return status == "exited" ? static_cast<int>(childExit) : status == "timeout" ? 124 : 130;
}
