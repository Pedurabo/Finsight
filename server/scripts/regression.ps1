[CmdletBinding(DefaultParameterSetName = "Manual")]
param(
    [Parameter(Mandatory = $true, ParameterSetName = "Manual")]
    [string]$DocumentId,

    [Parameter(Mandatory = $true, ParameterSetName = "Manual")]
    [ValidatePattern('^[A-Fa-f0-9]{64}$')]
    [string]$ExpectedUploadSha256,

    [Parameter(Mandatory = $true, ParameterSetName = "Manual")]
    [ValidatePattern('^[A-Fa-f0-9]{64}$')]
    [string]$ExpectedExtractionSha256,

    [Parameter(Mandatory = $true, ParameterSetName = "Manifest")]
    [string]$ManifestPath
)

$BaseUrl = "http://127.0.0.1:3001"

if ($PSCmdlet.ParameterSetName -eq "Manifest") {
    if (-not (Test-Path -LiteralPath $ManifestPath)) {
        throw "Regression manifest not found: $ManifestPath"
    }

    $resolvedManifestPath = (Resolve-Path -LiteralPath $ManifestPath).Path

    try {
        $manifest = Get-Content -LiteralPath $resolvedManifestPath -Raw |
            ConvertFrom-Json
    }
    catch {
        throw "Regression manifest is not valid JSON: $resolvedManifestPath"
    }

    $DocumentId = [string]$manifest.documentId
    $ExpectedUploadSha256 = [string]$manifest.uploadSha256
    $ExpectedExtractionSha256 = [string]$manifest.extractionSha256

    if ([string]::IsNullOrWhiteSpace($DocumentId)) {
        throw "Regression manifest is missing documentId."
    }

    if ($ExpectedUploadSha256 -notmatch '^[A-Fa-f0-9]{64}$') {
        throw "Regression manifest uploadSha256 is invalid."
    }

    if ($ExpectedExtractionSha256 -notmatch '^[A-Fa-f0-9]{64}$') {
        throw "Regression manifest extractionSha256 is invalid."
    }

    Write-Host "Manifest: $resolvedManifestPath"
    Write-Host "Corpus:   $($manifest.name)"
}

$RegressionProfile = "full-financial"
$CurrentYear = 2025
$PriorYear = 2024
$RevenueCurrent = 281724
$RevenuePrior = 245122
$IntelligentCloudRevenueCurrent = 106265
$IntelligentCloudRevenuePrior = 87464
$MorePersonalComputingRevenueCurrent = 54649
$MorePersonalComputingOperatingIncomeCurrent = 14166
$ProductivityBusinessProcessesRevenueCurrent = 120810

if ($PSCmdlet.ParameterSetName -eq "Manifest") {
    $checks = $manifest.expectedChecks

    $RegressionProfile = [string]$manifest.regressionProfile

    if ($RegressionProfile -notin @("full-financial", "generic-financial")) {
        throw "Regression manifest regressionProfile is invalid."
    }

    $requiredChecks = @(
        "currentYear",
        "priorYear",
        "revenueCurrent",
        "revenuePrior",
        "intelligentCloudRevenueCurrent",
        "intelligentCloudRevenuePrior",
        "morePersonalComputingRevenueCurrent",
        "morePersonalComputingOperatingIncomeCurrent",
        "productivityBusinessProcessesRevenueCurrent"
    )

    foreach ($field in $requiredChecks) {
        if ($null -eq $checks.$field) {
            throw "Regression manifest expectedChecks is missing $field."
        }
    }

    $CurrentYear = [int]$checks.currentYear
    $PriorYear = [int]$checks.priorYear
    $RevenueCurrent = [double]$checks.revenueCurrent
    $RevenuePrior = [double]$checks.revenuePrior
    $IntelligentCloudRevenueCurrent = [double]$checks.intelligentCloudRevenueCurrent
    $IntelligentCloudRevenuePrior = [double]$checks.intelligentCloudRevenuePrior
    $MorePersonalComputingRevenueCurrent = [double]$checks.morePersonalComputingRevenueCurrent
    $MorePersonalComputingOperatingIncomeCurrent = [double]$checks.morePersonalComputingOperatingIncomeCurrent
    $ProductivityBusinessProcessesRevenueCurrent = [double]$checks.productivityBusinessProcessesRevenueCurrent
}

$RevenuePercentage = (($RevenueCurrent - $RevenuePrior) / $RevenuePrior) * 100
$RevenueReportedPercentage = [math]::Round($RevenuePercentage)

$IntelligentCloudPercentage = (
    ($IntelligentCloudRevenueCurrent - $IntelligentCloudRevenuePrior) /
    $IntelligentCloudRevenuePrior
) * 100
$IntelligentCloudReportedPercentage = [math]::Round($IntelligentCloudPercentage)

$IntelligentCloudDifference = $IntelligentCloudRevenueCurrent - $IntelligentCloudRevenuePrior
$IntelligentCloudRatio = $IntelligentCloudRevenueCurrent / $IntelligentCloudRevenuePrior

$CrossScopeDifference = $IntelligentCloudRevenueCurrent - $MorePersonalComputingRevenueCurrent
$CrossScopeRatio = $ProductivityBusinessProcessesRevenueCurrent / $IntelligentCloudRevenueCurrent
$CrossScopeSubtraction = $MorePersonalComputingRevenueCurrent - $IntelligentCloudRevenueCurrent

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

if ($RegressionProfile -eq "generic-financial") {
    Write-Host ""
    Write-Host "=== VERIFY ==="

    $r = Invoke-FinSight "verify" "What was revenue in ${CurrentYear}?"
    Assert-Equal "generic revenue status" $r.status "supported"
    Assert-Equal "generic revenue value" $r.claim.value "$RevenueCurrent"

    $r = Invoke-FinSight "verify" "What was Intelligent Cloud revenue in ${CurrentYear}?"
    Assert-Equal "scoped revenue abstention" $r.status "insufficient_evidence"

    $r = Invoke-FinSight "verify" "What was Azure revenue in ${CurrentYear}?"
    Assert-Equal "unsupported Azure verify" $r.status "insufficient_evidence"

    Write-Host ""
    Write-Host "=== CALCULATE ==="

    $r = Invoke-FinSight "calculate" "What is the percentage change in revenue from $PriorYear to ${CurrentYear}?"
    Assert-Equal "generic percentage status" $r.status "supported"
    Assert-Near "generic percentage result" $r.calculation.result $RevenuePercentage
    Assert-Equal "generic reported percentage" $r.calculation.reportedValue $RevenueReportedPercentage
    Assert-Equal "generic rounding consistency" $r.calculation.roundingConsistent $true

    $r = Invoke-FinSight "calculate" "What is the percentage change in Intelligent Cloud revenue from $PriorYear to ${CurrentYear}?"
    Assert-Equal "scoped percentage abstention" $r.status "insufficient_evidence"

    $r = Invoke-FinSight "calculate" "Subtract Intelligent Cloud revenue in $PriorYear from Intelligent Cloud revenue in $CurrentYear."
    Assert-Equal "scoped subtraction abstention" $r.status "insufficient_evidence"

    $r = Invoke-FinSight "calculate" "What is the difference between Intelligent Cloud revenue and More Personal Computing revenue in ${CurrentYear}?"
    Assert-Equal "cross-scope difference abstention" $r.status "insufficient_evidence"

    $r = Invoke-FinSight "calculate" "What is the ratio between Intelligent Cloud revenue and More Personal Computing revenue in ${CurrentYear}?"
    Assert-Equal "cross-scope vague ratio abstention" $r.status "insufficient_evidence"

    Write-Host ""
    Write-Host "============================"
    Write-Host "Passed: $passed"
    Write-Host "Failed: $failed"
    Write-Host "============================"

    if ($failed -gt 0) {
        exit 1
    }

    exit 0
}

Write-Host ""
Write-Host "=== VERIFY ==="

$r = Invoke-FinSight "verify" "What was revenue in ${CurrentYear}?"
Assert-Equal "generic revenue status" $r.status "supported"
Assert-Equal "generic revenue value" $r.claim.value "$RevenueCurrent"

$r = Invoke-FinSight "verify" "What was Intelligent Cloud revenue in ${CurrentYear}?"
Assert-Equal "scoped revenue status" $r.status "supported"
Assert-Equal "scoped revenue value" $r.claim.value "$IntelligentCloudRevenueCurrent"

$r = Invoke-FinSight "verify" "What was More Personal Computing operating income in ${CurrentYear}?"
Assert-Equal "scoped operating income status" $r.status "supported"
Assert-Equal "scoped operating income value" $r.claim.value "$MorePersonalComputingOperatingIncomeCurrent"

$r = Invoke-FinSight "verify" "What was Azure revenue in ${CurrentYear}?"
Assert-Equal "unsupported Azure verify" $r.status "insufficient_evidence"

$r = Invoke-FinSight "verify" "What was Intelligent Cloud revenue in $CurrentYear, compared with More Personal Computing?"
Assert-Equal "supported distractor status" $r.status "supported"
Assert-Equal "supported distractor value" $r.claim.value "$IntelligentCloudRevenueCurrent"

$r = Invoke-FinSight "verify" "What was Azure revenue in $CurrentYear, compared with Intelligent Cloud?"
Assert-Equal "unsupported distractor" $r.status "insufficient_evidence"

$r = Invoke-FinSight "verify" "What was Intelligent Cloud revenue and More Personal Computing revenue in ${CurrentYear}?"
Assert-Equal "multi-scope verify" $r.status "insufficient_evidence"

Write-Host ""
Write-Host "=== CALCULATE ==="

$r = Invoke-FinSight "calculate" "What is the percentage change in revenue from $PriorYear to ${CurrentYear}?"
Assert-Equal "generic percentage status" $r.status "supported"
Assert-Near "generic percentage result" $r.calculation.result $RevenuePercentage
Assert-Equal "generic reported percentage" $r.calculation.reportedValue $RevenueReportedPercentage
Assert-Equal "generic rounding consistency" $r.calculation.roundingConsistent $true

$r = Invoke-FinSight "calculate" "What is the percentage change in Intelligent Cloud revenue from $PriorYear to ${CurrentYear}?"
Assert-Equal "scoped percentage status" $r.status "supported"
Assert-Near "scoped percentage result" $r.calculation.result $IntelligentCloudPercentage
Assert-Equal "scoped reported percentage" $r.calculation.reportedValue $IntelligentCloudReportedPercentage
Assert-Equal "scoped rounding consistency" $r.calculation.roundingConsistent $true

$r = Invoke-FinSight "calculate" "What is the difference in Intelligent Cloud revenue between $PriorYear and ${CurrentYear}?"
Assert-Equal "difference status" $r.status "supported"
Assert-Equal "difference result" $r.calculation.result $IntelligentCloudDifference
Assert-Equal "difference currency" $r.calculation.currency "USD"
Assert-Equal "difference unit" $r.calculation.unit "million"

$r = Invoke-FinSight "calculate" "Subtract Intelligent Cloud revenue in $PriorYear from Intelligent Cloud revenue in $CurrentYear."
Assert-Equal "forward subtraction status" $r.status "supported"
Assert-Equal "forward subtraction result" $r.calculation.result $IntelligentCloudDifference

$r = Invoke-FinSight "calculate" "Subtract Intelligent Cloud revenue in $CurrentYear from Intelligent Cloud revenue in $PriorYear."
Assert-Equal "reverse subtraction status" $r.status "supported"
Assert-Equal "reverse subtraction result" $r.calculation.result (-$IntelligentCloudDifference)

$r = Invoke-FinSight "calculate" "What is the ratio of Intelligent Cloud revenue in $CurrentYear to Intelligent Cloud revenue in ${PriorYear}?"
Assert-Equal "explicit ratio status" $r.status "supported"
Assert-Near "explicit ratio result" $r.calculation.result $IntelligentCloudRatio 0.0001
Assert-Equal "ratio currency" $r.calculation.currency $null
Assert-Equal "ratio unit" $r.calculation.unit $null

$r = Invoke-FinSight "calculate" "What is the ratio of Intelligent Cloud revenue between $PriorYear and ${CurrentYear}?"
Assert-Equal "vague ratio abstention" $r.status "insufficient_evidence"

$r = Invoke-FinSight "calculate" "What is the percentage change in Azure revenue from $PriorYear to ${CurrentYear}?"
Assert-Equal "unsupported Azure calculate" $r.status "insufficient_evidence"

$r = Invoke-FinSight "calculate" "What is the difference between Intelligent Cloud revenue and More Personal Computing revenue in ${CurrentYear}?"
Assert-Equal "cross-scope difference status" $r.status "supported"
Assert-Equal "cross-scope difference result" $r.calculation.result $CrossScopeDifference
Assert-Equal "cross-scope difference currency" $r.calculation.currency "USD"
Assert-Equal "cross-scope difference unit" $r.calculation.unit "million"

$r = Invoke-FinSight "calculate" "What is the ratio of Productivity and Business Processes revenue to Intelligent Cloud revenue in ${CurrentYear}?"
Assert-Equal "cross-scope ratio status" $r.status "supported"
Assert-Near "cross-scope ratio result" $r.calculation.result $CrossScopeRatio 0.0001
Assert-Equal "cross-scope ratio currency" $r.calculation.currency $null
Assert-Equal "cross-scope ratio unit" $r.calculation.unit $null

$r = Invoke-FinSight "calculate" "Subtract Intelligent Cloud revenue from More Personal Computing revenue in $CurrentYear."
Assert-Equal "cross-scope subtraction status" $r.status "supported"
Assert-Equal "cross-scope subtraction result" $r.calculation.result $CrossScopeSubtraction

$r = Invoke-FinSight "calculate" "What is the ratio between Intelligent Cloud revenue and More Personal Computing revenue in ${CurrentYear}?"
Assert-Equal "cross-scope vague ratio abstention" $r.status "insufficient_evidence"

$r = Invoke-FinSight "calculate" "What is the percentage change between Intelligent Cloud revenue and More Personal Computing revenue in ${CurrentYear}?"
Assert-Equal "cross-scope percentage abstention" $r.status "insufficient_evidence"

$r = Invoke-FinSight "calculate" "What is the percentage change in Intelligent Cloud gross margin from $PriorYear to ${CurrentYear}?"
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

