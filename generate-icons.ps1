Add-Type -AssemblyName System.Drawing

function New-VocDogIcon([int]$Size, [string]$Path) {
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $scale = $Size / 512.0

    $green = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#244d3f'))
    $tan = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#f2c989'))
    $dark = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#173229'))
    $pink = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#d87470'))
    $graphics.FillRectangle($green, 0, 0, $Size, $Size)

    $head = [System.Drawing.RectangleF]::new((104*$scale), (80*$scale), (304*$scale), (374*$scale))
    $graphics.FillEllipse($tan, $head)
    $graphics.FillPolygon($tan, [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new((116*$scale), (184*$scale)),
        [System.Drawing.PointF]::new((82*$scale), (83*$scale)),
        [System.Drawing.PointF]::new((202*$scale), (120*$scale))
    ))
    $graphics.FillPolygon($tan, [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new((396*$scale), (184*$scale)),
        [System.Drawing.PointF]::new((430*$scale), (83*$scale)),
        [System.Drawing.PointF]::new((310*$scale), (120*$scale))
    ))
    $graphics.FillEllipse($dark, 171*$scale, 221*$scale, 38*$scale, 38*$scale)
    $graphics.FillEllipse($dark, 303*$scale, 221*$scale, 38*$scale, 38*$scale)
    $graphics.FillEllipse($dark, 207*$scale, 291*$scale, 98*$scale, 89*$scale)
    $graphics.FillEllipse($pink, 224*$scale, 345*$scale, 64*$scale, 43*$scale)

    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
    $green.Dispose()
    $tan.Dispose()
    $dark.Dispose()
    $pink.Dispose()
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
New-VocDogIcon 192 (Join-Path $scriptRoot 'icon-192.png')
New-VocDogIcon 512 (Join-Path $scriptRoot 'icon-512.png')
