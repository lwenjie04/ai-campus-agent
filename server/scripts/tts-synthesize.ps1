param(
  [Parameter(Mandatory = $true)]
  [string]$Text,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [string]$VoiceName = "",

  [int]$Rate = 0
)

# 使用 Windows 自带的 SAPI COM 组件生成 wav。
# 这一实现不依赖 System.Speech，兼容性更高。
$voice = $null
$stream = $null

try {
  $voice = New-Object -ComObject SAPI.SpVoice
  $stream = New-Object -ComObject SAPI.SpFileStream

  if ($VoiceName -and $VoiceName.Trim().Length -gt 0) {
    $matchedVoice = $voice.GetVoices() | Where-Object {
      $_.GetDescription() -like "*$VoiceName*"
    } | Select-Object -First 1

    if ($matchedVoice) {
      $voice.Voice = $matchedVoice
    }
  }

  $safeRate = [Math]::Max(-10, [Math]::Min(10, $Rate))
  $voice.Rate = $safeRate

  # 3 = SSFMCreateForWrite
  $stream.Open($OutputPath, 3, $false)
  $voice.AudioOutputStream = $stream
  [void]$voice.Speak($Text)
}
finally {
  if ($stream) {
    $stream.Close()
  }
}
