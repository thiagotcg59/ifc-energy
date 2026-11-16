# Inicia o ifc-energy: backend (porta 8000) + front-end (porta 5173).
# Uso, no PowerShell, dentro da pasta do projeto:   .\iniciar.ps1
# Para parar: Ctrl+C nesta janela.

$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot

function Exigir($comando, $comoInstalar) {
    if (-not (Get-Command $comando -ErrorAction SilentlyContinue)) {
        Write-Host "Falta o programa '$comando'. $comoInstalar" -ForegroundColor Red
        exit 1
    }
}

function PortaOcupada($porta) {
    $cliente = New-Object System.Net.Sockets.TcpClient
    try { $cliente.Connect('127.0.0.1', $porta); return $true }
    catch { return $false }
    finally { $cliente.Close() }
}

Exigir 'uv' 'Instale em https://docs.astral.sh/uv/ e abra o PowerShell de novo.'
Exigir 'npm' 'Instale o Node.js 24 em https://nodejs.org/ e abra o PowerShell de novo.'

foreach ($porta in 8000, 5173) {
    if (PortaOcupada $porta) {
        Write-Host "A porta $porta já está em uso. O ifc-energy já está aberto em outra janela? Feche-a e tente de novo." -ForegroundColor Red
        exit 1
    }
}

Write-Host '1/3 Conferindo as dependências do backend...' -ForegroundColor Cyan
Push-Location (Join-Path $raiz 'backend')
uv sync --locked --quiet
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location

Write-Host '2/3 Conferindo as dependências do front-end...' -ForegroundColor Cyan
Push-Location (Join-Path $raiz 'frontend')
if (-not (Test-Path 'node_modules')) {
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
}
Pop-Location

Write-Host '3/3 Iniciando o backend e o front-end...' -ForegroundColor Cyan
$backend = Start-Process -FilePath 'uv' `
    -ArgumentList 'run', 'uvicorn', 'app.main:app', '--port', '8000' `
    -WorkingDirectory (Join-Path $raiz 'backend') -NoNewWindow -PassThru

try {
    $pronto = $false
    foreach ($tentativa in 1..60) {
        if ($backend.HasExited) { break }
        if (PortaOcupada 8000) { $pronto = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $pronto) {
        Write-Host 'O backend não iniciou. Veja a mensagem de erro acima.' -ForegroundColor Red
        exit 1
    }
    Write-Host ''
    Write-Host 'Pronto! Abrindo http://localhost:5173 no navegador.' -ForegroundColor Green
    Write-Host 'Para parar tudo, pressione Ctrl+C nesta janela.' -ForegroundColor Green
    Write-Host ''
    Push-Location (Join-Path $raiz 'frontend')
    npm run dev -- --open
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
    if ($backend -and -not $backend.HasExited) {
        # /T encerra também os processos filhos (uvicorn).
        taskkill /PID $backend.Id /T /F | Out-Null
    }
    Write-Host 'ifc-energy encerrado.'
}
