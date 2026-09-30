param(
    [Parameter(Mandatory = $true)]
    [string]$DocumentId,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Fa-f0-9]{64}$')]
    [string]$ExpectedUploadSha256,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Fa-f0-9]{64}$')]
    [string]$ExpectedExtractionSha256
)

$BaseUrl = "http://127.0.0.1:3001"
$ServerRoot = Split-Path -Parent $PSScriptRoot
$UploadPath = Join-Path $ServerRoot "uploads\$DocumentId"
$ExtractionPath = Join-Path $ServerRoot "extracted\$DocumentId.json"

function Assert-CorpusArtifact {
    param(
        [string]$Label,
        [string]$Path,
        [string]$ExpectedSha256
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Host "CORPUS FAIL  $Label is missing"
        Write-Host "             $Path"
        exit 1
    }

    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    $expected = $ExpectedSha256.ToUpperInvariant()

    if ($actual -ne $expected) {
        Write-Host "CORPUS FAIL  $Label SHA256 mismatch"
        Write-Host "             Expected: $expected"
        Write-Host "             Actual:   $actual"
        exit 1
    }

    Write-Host "CORPUS PASS  $Label SHA256 verified"
}

Write-Host ""
Write-Host "=== CORPUS INTEGRITY ==="

Assert-CorpusArtifact `
    -Label "upload" `
    -Path $UploadPath `
    -ExpectedSha256 $ExpectedUploadSha256

Assert-CorpusArtifact `
    -Label "extraction" `
    -Path $ExtractionPath `
    -ExpectedSha256 $ExpectedExtractionSha256


$passed = 0
$failed = 0

function Assert-Equal {
    param(
        [string]$Test,
        $Actual,
        $Expected
    )

    if ($Actual -eq $Expected) {
        Write-Host "PASS  $Test"
        $script:passed++
    }
    else {
        Write-Host "FAIL  $Test"
        Write-Host "      Expected: $Expected"
        Write-Host "      Actual:   $Actual"
        $script:failed++
    }
}

function Assert-Near {
    param(
        [string]$Test,
        [double]$Actual,
        [double]$Expected,
        [double]$Tolerance = 0.0001
    )

    if ([math]::Abs($Actual - $Expected) -le $Tolerance) {
        Write-Host "PASS  $Test"
        $script:passed++
    }
    else {
        Write-Host "FAIL  $Test"
        Write-Host "      Expected: $Expected"
        Write-Host "      Actual:   $Actual"
        $script:failed++
    }
}

function Invoke-FinSight {
    param(
        [string]$Endpoint,
        [string]$Question
    )

    $body = @{
        question = $Question
    } | ConvertTo-Json

    Invoke-RestMethod `
        -Uri "$BaseUrl/api/documents/$DocumentId/$Endpoint" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
}

Write-Host ""
Write-Host "=== VERIFY ==="

$r = Invoke-FinSight "verify" "What was revenue in 2025?"
Assert-Equal "generic revenue status" $r.status "supported"
Assert-Equal "generic revenue value" $r.claim.value "281724"

$r = Invoke-FinSight "verify" "What was Intelligent Cloud revenue in 2025?"
Assert-Equal "scoped revenue status" $r.status "supported"
Assert-Equal "scoped revenue value" $r.claim.value "106265"

$r = Invoke-FinSight "verify" "What was More Personal Computing operating income in 2025?"
Assert-Equal "scoped operating income status" $r.status "supported"
Assert-Equal "scoped operating income value" $r.claim.value "14166"

$r = Invoke-FinSight "verify" "What was Azure revenue in 2025?"
Assert-Equal "unsupported Azure verify" $r.status "insufficient_evidence"

$r = Invoke-FinSight "verify" "What was Intelligent Cloud revenue in 2025, compared with More Personal Computing?"
Assert-Equal "supported distractor status" $r.status "supported"
Assert-Equal "supported distractor value" $r.claim.value "106265"

$r = Invoke-FinSight "verify" "What was Azure revenue in 2025, compared with Intelligent Cloud?"
Assert-Equal "unsupported distractor" $r.status "insufficient_evidence"

$r = Invoke-FinSight "verify" "What was Intelligent Cloud revenue and More Personal Computing revenue in 2025?"
Assert-Equal "multi-scope verify" $r.status "insufficient_evidence"

Write-Host ""
Write-Host "=== CALCULATE ==="

$r = Invoke-FinSight "calculate" "What is the percentage change in revenue from 2024 to 2025?"
Assert-Equal "generic percentage status" $r.status "supported"
Assert-Near "generic percentage result" $r.calculation.result 14.9322
Assert-Equal "generic reported percentage" $r.calculation.reportedValue 15
Assert-Equal "generic rounding consistency" $r.calculation.roundingConsistent $true

$r = Invoke-FinSight "calculate" "What is the percentage change in Intelligent Cloud revenue from 2024 to 2025?"
Assert-Equal "scoped percentage status" $r.status "supported"
Assert-Near "scoped percentage result" $r.calculation.result 21.4957
Assert-Equal "scoped reported percentage" $r.calculation.reportedValue 21
Assert-Equal "scoped rounding consistency" $r.calculation.roundingConsistent $true

$r = Invoke-FinSight "calculate" "What is the difference in Intelligent Cloud revenue between 2024 and 2025?"
Assert-Equal "difference status" $r.status "supported"
Assert-Equal "difference result" $r.calculation.result 18801
Assert-Equal "difference currency" $r.calculation.currency "USD"
Assert-Equal "difference unit" $r.calculation.unit "million"

$r = Invoke-FinSight "calculate" "Subtract Intelligent Cloud revenue in 2024 from Intelligent Cloud revenue in 2025."
Assert-Equal "forward subtraction status" $r.status "supported"
Assert-Equal "forward subtraction result" $r.calculation.result 18801

$r = Invoke-FinSight "calculate" "Subtract Intelligent Cloud revenue in 2025 from Intelligent Cloud revenue in 2024."
Assert-Equal "reverse subtraction status" $r.status "supported"
Assert-Equal "reverse subtraction result" $r.calculation.result -18801

$r = Invoke-FinSight "calculate" "What is the ratio of Intelligent Cloud revenue in 2025 to Intelligent Cloud revenue in 2024?"
Assert-Equal "explicit ratio status" $r.status "supported"
Assert-Near "explicit ratio result" $r.calculation.result 1.215 0.0001
Assert-Equal "ratio currency" $r.calculation.currency $null
Assert-Equal "ratio unit" $r.calculation.unit $null

$r = Invoke-FinSight "calculate" "What is the ratio of Intelligent Cloud revenue between 2024 and 2025?"
Assert-Equal "vague ratio abstention" $r.status "insufficient_evidence"

$r = Invoke-FinSight "calculate" "What is the percentage change in Azure revenue from 2024 to 2025?"
Assert-Equal "unsupported Azure calculate" $r.status "insufficient_evidence"

$r = Invoke-FinSight "calculate" "What is the difference between Intelligent Cloud revenue and More Personal Computing revenue in 2025?"
Assert-Equal "cross-scope difference status" $r.status "supported"
Assert-Equal "cross-scope difference result" $r.calculation.result 51616
Assert-Equal "cross-scope difference currency" $r.calculation.currency "USD"
Assert-Equal "cross-scope difference unit" $r.calculation.unit "million"

$r = Invoke-FinSight "calculate" "What is the ratio of Productivity and Business Processes revenue to Intelligent Cloud revenue in 2025?"
Assert-Equal "cross-scope ratio status" $r.status "supported"
Assert-Near "cross-scope ratio result" $r.calculation.result 1.1369 0.0001
Assert-Equal "cross-scope ratio currency" $r.calculation.currency $null
Assert-Equal "cross-scope ratio unit" $r.calculation.unit $null

$r = Invoke-FinSight "calculate" "Subtract Intelligent Cloud revenue from More Personal Computing revenue in 2025."
Assert-Equal "cross-scope subtraction status" $r.status "supported"
Assert-Equal "cross-scope subtraction result" $r.calculation.result -51616

$r = Invoke-FinSight "calculate" "What is the ratio between Intelligent Cloud revenue and More Personal Computing revenue in 2025?"
Assert-Equal "cross-scope vague ratio abstention" $r.status "insufficient_evidence"

$r = Invoke-FinSight "calculate" "What is the percentage change between Intelligent Cloud revenue and More Personal Computing revenue in 2025?"
Assert-Equal "cross-scope percentage abstention" $r.status "insufficient_evidence"

$r = Invoke-FinSight "calculate" "What is the percentage change in Intelligent Cloud gross margin from 2024 to 2025?"
Assert-Equal "missing scoped metric" $r.status "insufficient_evidence"

Write-Host ""
Write-Host "============================"
Write-Host "Passed: $passed"
Write-Host "Failed: $failed"
Write-Host "============================"

if ($failed -gt 0) {
    exit 1
}

exit 0

