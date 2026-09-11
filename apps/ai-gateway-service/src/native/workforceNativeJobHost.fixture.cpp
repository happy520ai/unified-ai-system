// Credential-free ownership fixture. Every fixture process has a 120-second upper lifetime.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <string>

namespace {
std::wstring Quote(const std::wstring& value) {
  std::wstring out = L"\""; size_t slashes = 0;
  for (const auto ch : value) { if (ch == L'\\') { ++slashes; continue; }
    out.append(ch == L'"' ? slashes * 2 + 1 : slashes, L'\\'); out += ch; slashes = 0; }
  out.append(slashes * 2, L'\\'); return out + L'"';
}
bool Print(const std::string& text) { DWORD written = 0;
  return WriteFile(GetStdHandle(STD_OUTPUT_HANDLE), text.data(), static_cast<DWORD>(text.size()), &written, nullptr) && written == text.size(); }
}
int wmain(int argc, wchar_t** argv) {
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
  if (argc == 3 && std::wstring(argv[1]) == L"--signal") {
    HANDLE event = OpenEventW(EVENT_MODIFY_STATE, FALSE, argv[2]); if (!event) return 40;
    const bool signalled = SetEvent(event); CloseHandle(event); return signalled ? 0 : 41;
  }
  if (argc == 3 && std::wstring(argv[1]) == L"--grandchild") {
    HANDLE marker = CreateFileW(argv[2], GENERIC_WRITE, FILE_SHARE_READ, nullptr, CREATE_NEW, FILE_ATTRIBUTE_NORMAL, nullptr); if (marker == INVALID_HANDLE_VALUE) return 42;
    const auto text = std::to_string(GetCurrentProcessId()) + "\n"; DWORD written = 0;
    const bool marked = WriteFile(marker, text.data(), static_cast<DWORD>(text.size()), &written, nullptr) && written == text.size(); CloseHandle(marker);
    if (!marked) return 43; Sleep(120000); return 0;
  }
  if (argc != 4 || std::wstring(argv[1]) != L"--tree" || (std::wstring(argv[2]) != L"normal" && std::wstring(argv[2]) != L"stay")) return 44;
  wchar_t executable[32768]; const DWORD count = GetModuleFileNameW(nullptr, executable, 32768); if (!count || count >= 32768) return 45;
  std::wstring command = Quote(executable) + L" --grandchild " + Quote(argv[3]);
  STARTUPINFOW startup{}; startup.cb = sizeof(startup); PROCESS_INFORMATION child{};
  if (!CreateProcessW(executable, command.data(), nullptr, nullptr, FALSE, CREATE_NO_WINDOW, nullptr, nullptr, &startup, &child)) return 46;
  CloseHandle(child.hThread); const ULONGLONG end = GetTickCount64() + 5000;
  while (GetFileAttributesW(argv[3]) == INVALID_FILE_ATTRIBUTES && GetTickCount64() < end && WaitForSingleObject(child.hProcess, 0) == WAIT_TIMEOUT) Sleep(10);
  const bool ready = GetFileAttributesW(argv[3]) != INVALID_FILE_ATTRIBUTES;
  const bool printed = ready && Print("{\"childPid\":" + std::to_string(GetCurrentProcessId()) + ",\"grandchildPid\":" + std::to_string(child.dwProcessId) + "}\n");
  CloseHandle(child.hProcess); if (!printed) return 47;
  if (std::wstring(argv[2]) == L"normal") { Sleep(50); return 17; }
  Sleep(120000); return 0;
}
