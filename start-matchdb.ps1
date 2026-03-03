<# ──────────────────────────────────────────────────────────────────────────────
   start-matchdb.ps1  —  Kill stale processes & launch all MatchDB services
   Ports: 3000 (Shell UI), 3001 (Jobs UI), 4000 (Shell UI Server),
          4001 (Jobs UI Server), 8000 (Shell Services), 8001 (Jobs Services)
   ────────────────────────────────────────────────────────────────────────────── #>

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# ─── 1. Kill any process occupying our ports ─────────────────────────────────
$ports = @(3000, 3001, 4000, 4001, 8000, 8001)
Write-Host "`n=== Clearing ports: $($ports -join ', ') ===" -ForegroundColor Cyan

foreach ($p in $ports) {
    $procIds = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue |
               Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $procIds) {
        try {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "  Killing PID $procId ($($proc.ProcessName)) on port $p" -ForegroundColor Yellow
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        } catch { }
    }
}
Write-Host "All ports cleared.`n" -ForegroundColor Green

# ─── 2. Launch services as background jobs ───────────────────────────────────
$services = @(
    @{ Name = "Shell Services (8000)";  Path = "$root\matchdb-shell-services" },
    @{ Name = "Jobs Services  (8001)";  Path = "$root\matchdb-jobs-services"  },
    @{ Name = "Shell UI       (3000)";  Path = "$root\matchdb-shell-ui"       },
    @{ Name = "Jobs UI        (3001)";  Path = "$root\matchdb-jobs-ui"        }
)

foreach ($svc in $services) {
    Write-Host "Starting $($svc.Name) ..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$($svc.Path)'; npm run dev" -WindowStyle Normal
}

Write-Host "`n=== All MatchDB services launched ===" -ForegroundColor Green
Write-Host "  Shell Services : http://localhost:8000"
Write-Host "  Jobs Services  : http://localhost:8001"
Write-Host "  Shell UI       : http://localhost:3000"
Write-Host "  Jobs UI        : http://localhost:3001"
Write-Host ""
