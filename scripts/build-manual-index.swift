#!/usr/bin/env swift

import AppKit
import Foundation
import PDFKit
import Vision

struct ManualDefinition {
    let id: String
    let slug: String
    let title: String
    let system: String
}

struct IndexedPage: Codable {
    let manualId: String
    let page: Int
    let text: String
}

struct ManualIndex: Codable {
    let version: Int
    let generatedAt: String
    let system: String
    let manuals: [String]
    let pages: [IndexedPage]
}

let manualDefinitions = [
    ManualDefinition(id: "player", slug: "Giocatore", title: "Manuale del Giocatore", system: "dnd5e"),
    ManualDefinition(id: "master", slug: "DM", title: "Guida del Dungeon Master", system: "dnd5e"),
    ManualDefinition(id: "monsters", slug: "Mostri", title: "Manuale dei Mostri", system: "dnd5e"),
    ManualDefinition(id: "base", slug: "PathfinderBase", title: "Manuale Base Pathfinder", system: "pathfinder2e"),
    ManualDefinition(id: "gm", slug: "PathfinderGM", title: "Guida del Game Master", system: "pathfinder2e"),
    ManualDefinition(id: "bestiary", slug: "PathfinderBestiario", title: "Bestiario Pathfinder", system: "pathfinder2e")
]

func argumentValue(_ name: String) -> String? {
    guard let index = CommandLine.arguments.firstIndex(of: name), index + 1 < CommandLine.arguments.count else {
        return nil
    }
    return CommandLine.arguments[index + 1]
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("Errore: \(message)\n".utf8))
    exit(1)
}

func pageNumber(for url: URL, slug: String) -> Int? {
    let name = url.deletingPathExtension().lastPathComponent
    let prefix = "\(slug)-"
    guard name.hasPrefix(prefix) else { return nil }
    return Int(name.dropFirst(prefix.count))
}

func pageImage(from url: URL) -> CGImage? {
    guard
        let document = PDFDocument(url: url),
        let page = document.page(at: 0)
    else {
        return nil
    }

    let bounds = page.bounds(for: .mediaBox)
    let targetWidth: CGFloat = 1800
    let scale = targetWidth / max(bounds.width, 1)
    let targetSize = CGSize(width: targetWidth, height: max(1, bounds.height * scale))
    let image = page.thumbnail(of: targetSize, for: .mediaBox)

    guard
        let data = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: data)
    else {
        return nil
    }
    return bitmap.cgImage
}

func normalizedText(_ value: String) -> String {
    value
        .replacingOccurrences(of: "\u{00AD}", with: "")
        .replacingOccurrences(of: "[ \\t]+", with: " ", options: .regularExpression)
        .replacingOccurrences(of: "\\n{3,}", with: "\n\n", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
}

func recognizeText(in image: CGImage) throws -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["it-IT", "en-US"]
    request.minimumTextHeight = 0.009

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try handler.perform([request])

    let observations = (request.results ?? []).sorted { lhs, rhs in
        let verticalDistance = abs(lhs.boundingBox.midY - rhs.boundingBox.midY)
        if verticalDistance > 0.012 {
            return lhs.boundingBox.midY > rhs.boundingBox.midY
        }
        return lhs.boundingBox.minX < rhs.boundingBox.minX
    }

    return normalizedText(observations.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n"))
}

let workspace = URL(fileURLWithPath: argumentValue("--workspace") ?? FileManager.default.currentDirectoryPath)
let requestedSystem = argumentValue("--system")
let requestedManual = argumentValue("--manual")
let outputPath = argumentValue("--output")

let selectedDefinitions = manualDefinitions.filter { definition in
    if let requestedManual {
        return definition.slug == requestedManual || definition.id == requestedManual
    }
    if let requestedSystem {
        return definition.system == requestedSystem
    }
    return true
}

guard !selectedDefinitions.isEmpty else {
    fail("nessun manuale corrisponde ai filtri richiesti.")
}

var indexedPages: [IndexedPage] = []
let fileManager = FileManager.default

for definition in selectedDefinitions {
    let folder = workspace
        .appendingPathComponent("public")
        .appendingPathComponent("manuals")
        .appendingPathComponent(definition.slug)

    guard let files = try? fileManager.contentsOfDirectory(
        at: folder,
        includingPropertiesForKeys: nil,
        options: [.skipsHiddenFiles]
    ) else {
        fail("cartella non trovata: \(folder.path)")
    }

    let pageFiles = files.compactMap { url -> (Int, URL)? in
        guard url.pathExtension.lowercased() == "pdf", let page = pageNumber(for: url, slug: definition.slug) else {
            return nil
        }
        return (page, url)
    }.sorted { $0.0 < $1.0 }

    print("Indicizzazione \(definition.title): \(pageFiles.count) pagine")

    for (position, item) in pageFiles.enumerated() {
        autoreleasepool {
            let page = item.0
            let url = item.1
            do {
                guard let image = pageImage(from: url) else {
                    FileHandle.standardError.write(Data("Impossibile renderizzare \(url.lastPathComponent)\n".utf8))
                    return
                }
                let text = try recognizeText(in: image)
                indexedPages.append(IndexedPage(manualId: definition.id, page: page, text: text))
                print("[\(position + 1)/\(pageFiles.count)] \(definition.slug) pagina \(page): \(text.count) caratteri")
            } catch {
                FileHandle.standardError.write(Data("OCR fallito per \(url.lastPathComponent): \(error)\n".utf8))
            }
        }
    }
}

let systemName: String
if let requestedSystem {
    systemName = requestedSystem
} else {
    let systems = Set(selectedDefinitions.map(\.system))
    systemName = systems.count == 1 ? systems.first! : "all"
}

let formatter = ISO8601DateFormatter()
let index = ManualIndex(
    version: 1,
    generatedAt: formatter.string(from: Date()),
    system: systemName,
    manuals: selectedDefinitions.map(\.id),
    pages: indexedPages.sorted {
        if $0.manualId == $1.manualId { return $0.page < $1.page }
        return $0.manualId < $1.manualId
    }
)

let encoder = JSONEncoder()
encoder.outputFormatting = [.withoutEscapingSlashes]
let data = try encoder.encode(index)

let destination: URL
if let outputPath {
    destination = URL(fileURLWithPath: outputPath, relativeTo: workspace).standardizedFileURL
} else {
    destination = workspace
        .appendingPathComponent("public")
        .appendingPathComponent("manual-index")
        .appendingPathComponent("\(systemName).json")
}

try fileManager.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
try data.write(to: destination, options: .atomic)
print("Indice scritto in \(destination.path) (\(indexedPages.count) pagine, \(data.count) byte)")
