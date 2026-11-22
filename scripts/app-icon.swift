import AppKit

let output = URL(fileURLWithPath: CommandLine.arguments[1])
let scales = [16, 32, 128, 256, 512]

func render(_ size: Int, to file: URL) throws {
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()
    let scale = CGFloat(size) / 64
    let box = NSRect(x: 3 * scale, y: 3 * scale, width: 58 * scale, height: 58 * scale)
    let path = NSBezierPath(roundedRect: box, xRadius: 16 * scale, yRadius: 16 * scale)
    NSColor(srgbRed: 0.55, green: 0.46, blue: 0.96, alpha: 1).setFill()
    path.fill()
    let star = NSBezierPath()
    for (index, point) in [(32, 51), (37, 37), (51, 32), (37, 27), (32, 13), (27, 27), (13, 32), (27, 37)].enumerated() {
        let position = NSPoint(x: CGFloat(point.0) * scale, y: CGFloat(point.1) * scale)
        if index == 0 { star.move(to: position) } else { star.line(to: position) }
    }
    star.close()
    NSColor.white.setFill()
    star.fill()
    image.unlockFocus()
    guard let tiff = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff) else { throw CocoaError(.fileWriteUnknown) }
    // lockFocus can render at the display's backing scale. Resize to exact iconset pixels.
    guard let scaled = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
        samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    ), let context = NSGraphicsContext(bitmapImageRep: scaled) else { throw CocoaError(.fileWriteUnknown) }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    bitmap.draw(in: NSRect(x: 0, y: 0, width: size, height: size))
    NSGraphicsContext.restoreGraphicsState()
    guard let png = scaled.representation(using: .png, properties: [:]) else { throw CocoaError(.fileWriteUnknown) }
    try png.write(to: file)
}

for size in scales {
    try render(size, to: output.appendingPathComponent("icon_\(size)x\(size).png"))
    try render(size * 2, to: output.appendingPathComponent("icon_\(size)x\(size)@2x.png"))
}
