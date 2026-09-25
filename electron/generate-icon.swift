import AppKit
import Foundation

guard CommandLine.arguments.count == 2 else {
    fputs("Usage: swift generate-icon.swift output.png\n", stderr)
    exit(1)
}

let size = 1024
guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: size,
    pixelsHigh: size,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fatalError("Unable to create icon bitmap")
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
context.imageInterpolation = .high
NSColor(calibratedRed: 23/255, green: 36/255, blue: 43/255, alpha: 1).setFill()
NSBezierPath(roundedRect: NSRect(x: 0, y: 0, width: size, height: size), xRadius: 224, yRadius: 224).fill()
NSColor(calibratedRed: 218/255, green: 132/255, blue: 92/255, alpha: 1).setFill()
NSBezierPath(roundedRect: NSRect(x: 104, y: 104, width: 816, height: 816), xRadius: 204, yRadius: 204).fill()

NSColor(calibratedRed: 1, green: 249/255, blue: 239/255, alpha: 1).setStroke()
for y in [360.0, 512.0, 664.0] {
    let wave = NSBezierPath()
    wave.lineWidth = 72
    wave.lineCapStyle = .round
    wave.move(to: NSPoint(x: 218, y: y))
    wave.curve(to: NSPoint(x: 512, y: y),
               controlPoint1: NSPoint(x: 320, y: y + 75),
               controlPoint2: NSPoint(x: 410, y: y + 75))
    wave.curve(to: NSPoint(x: 806, y: y),
               controlPoint1: NSPoint(x: 614, y: y - 75),
               controlPoint2: NSPoint(x: 704, y: y - 75))
    wave.stroke()
}
context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

guard let data = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Unable to encode icon PNG")
}
try data.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
