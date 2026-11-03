import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';

import {
    parseBinaryXml, scoreCompatibility, collectNativeLibraries, analyzeApk, formatBytes
} from '../../src/components/features/applab/apk.js';
import { assessPorting, assessSourcePorting, inspectSourceArchive } from '../../src/components/features/applab/porting.js';
import { appLabErrorMessage } from '../../src/components/features/applab/appLabLibrary.js';

/* ---------------------------------------------------------------- */
/* Costruzione di un APK sintetico (ZIP + AndroidManifest binario)  */
/* ---------------------------------------------------------------- */

const u16 = value => {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(value);
    return buffer;
};
const u32 = value => {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(value >>> 0);
    return buffer;
};
const pad4 = buffer => buffer.length % 4
    ? Buffer.concat([buffer, Buffer.alloc(4 - (buffer.length % 4))])
    : buffer;

const CHUNK = { POOL: 0x0001, XML: 0x0003, START: 0x0102, END: 0x0103 };

function stringPool(strings) {
    const encoded = strings.map(value => {
        const data = Buffer.from(value, 'utf8');
        return Buffer.concat([Buffer.from([value.length, data.length]), data, Buffer.from([0])]);
    });
    const offsets = [];
    let cursor = 0;
    for (const item of encoded) {
        offsets.push(cursor);
        cursor += item.length;
    }
    let data = Buffer.concat(encoded);
    const headerSize = 28;
    const stringsStart = headerSize + offsets.length * 4;
    data = pad4(data);
    const size = stringsStart + data.length;
    const header = Buffer.concat([
        u16(CHUNK.POOL), u16(headerSize), u32(size),
        u32(strings.length), u32(0), u32(0x100),
        u32(stringsStart), u32(0)
    ]);
    return Buffer.concat([header, ...offsets.map(u32), data]);
}

const startElement = (nameIndex, attributes) => {
    const body = Buffer.concat(attributes.map(attribute => Buffer.concat([
        u32(0xffffffff),
        u32(attribute.name),
        u32(attribute.raw ?? 0xffffffff),
        u16(8),
        Buffer.from([0]),
        Buffer.from([attribute.type ?? 0x03]),
        u32(attribute.data ?? 0)
    ])));
    const size = 36 + body.length;
    return Buffer.concat([
        u16(CHUNK.START), u16(16), u32(size),
        u32(0), u32(0xffffffff),
        u32(0xffffffff), u32(nameIndex),
        u16(20), u16(20), u16(attributes.length),
        u16(0), u16(0), u16(0),
        body
    ]);
};

const endElement = nameIndex => Buffer.concat([
    u16(CHUNK.END), u16(16), u32(24),
    u32(0), u32(0xffffffff), u32(0xffffffff), u32(nameIndex)
]);

function buildManifestXml() {
    const strings = [
        'manifest', 'package', 'versionName', 'versionCode',
        'uses-sdk', 'minSdkVersion', 'targetSdkVersion',
        'application', 'label', 'icon',
        'uses-permission', 'name',
        'com.example.demo', '1.2.3', 'Demo App',
        'android.permission.INTERNET', 'android.permission.CAMERA',
        '@0x7f0e0000'
    ];
    const index = value => strings.indexOf(value);
    const chunks = [
        startElement(index('manifest'), [
            { name: index('package'), raw: index('com.example.demo') },
            { name: index('versionName'), raw: index('1.2.3') },
            { name: index('versionCode'), type: 0x10, data: 5 }
        ]),
        startElement(index('uses-sdk'), [
            { name: index('minSdkVersion'), type: 0x10, data: 24 },
            { name: index('targetSdkVersion'), type: 0x10, data: 34 }
        ]),
        endElement(index('uses-sdk')),
        startElement(index('uses-permission'), [{ name: index('name'), raw: index('android.permission.INTERNET') }]),
        endElement(index('uses-permission')),
        startElement(index('uses-permission'), [{ name: index('name'), raw: index('android.permission.CAMERA') }]),
        endElement(index('uses-permission')),
        startElement(index('application'), [
            { name: index('label'), raw: index('Demo App') },
            { name: index('icon'), raw: index('@0x7f0e0000') }
        ]),
        endElement(index('application')),
        endElement(index('manifest'))
    ];
    const pool = stringPool(strings);
    const body = Buffer.concat(chunks);
    const header = Buffer.concat([u16(CHUNK.XML), u16(8), u32(8 + pool.length + body.length)]);
    return Buffer.concat([header, pool, body]);
}

function buildZip(files, { deflate = [] } = {}) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const [name, content] of Object.entries(files)) {
        const data = Buffer.from(content);
        const nameBuffer = Buffer.from(name);
        const compressed = deflate.includes(name) ? deflateRawSync(data) : data;
        const method = deflate.includes(name) ? 8 : 0;
        const local = Buffer.concat([
            u32(0x04034b50), u16(20), u16(0), u16(method), u16(0), u16(0),
            u32(0), u32(compressed.length), u32(data.length),
            u16(nameBuffer.length), u16(0), nameBuffer, compressed
        ]);
        const central = Buffer.concat([
            u32(0x02014b50), u16(20), u16(20), u16(0), u16(method), u16(0), u16(0),
            u32(0), u32(compressed.length), u32(data.length),
            u16(nameBuffer.length), u16(0), u16(0), u16(0), u16(0), u32(0),
            u32(offset), nameBuffer
        ]);
        locals.push(local);
        centrals.push(central);
        offset += local.length;
    }
    const centralDirectory = Buffer.concat(centrals);
    const eocd = Buffer.concat([
        u32(0x06054b50), u16(0), u16(0), u16(centrals.length), u16(centrals.length),
        u32(centralDirectory.length), u32(offset), u16(0)
    ]);
    return Buffer.concat([...locals, centralDirectory, eocd]);
}

class TestFile {
    constructor(bytes, name) {
        this.bytes = Buffer.from(bytes);
        this.name = name;
        this.size = this.bytes.length;
    }
    slice(start, end) {
        const slice = this.bytes.subarray(start, end);
        return { arrayBuffer: async () => slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) };
    }
}

const makeFile = (bytes, name) => typeof File !== 'undefined' ? new File([bytes], name) : new TestFile(bytes, name);

/* ---------------------------------------------------------------- */

test('AXML: legge package, versioni e SDK dal manifest binario', () => {
    const document = parseBinaryXml(buildManifestXml());
    const manifest = document.children.find(node => node.name === 'manifest');
    assert.equal(manifest.attributes.package, 'com.example.demo');
    assert.equal(manifest.attributes.versionName, '1.2.3');
    assert.equal(manifest.attributes.versionCode, 5);
    const sdk = manifest.children.find(node => node.name === 'uses-sdk');
    assert.equal(sdk.attributes.minSdkVersion, 24);
    assert.equal(sdk.attributes.targetSdkVersion, 34);
    const permissions = manifest.children.filter(node => node.name === 'uses-permission');
    assert.equal(permissions.length, 2);
});

test('APK: analisi completa di un pacchetto store-only', async () => {
    const file = makeFile(buildZip({
        'AndroidManifest.xml': buildManifestXml(),
        'classes.dex': Buffer.from('dex\n035\0fake'),
        'lib/x86_64/libdemo.so': Buffer.from('elf-fake')
    }), 'demo.apk');

    const result = await analyzeApk(file);
    assert.equal(result.packageName, 'com.example.demo');
    assert.equal(result.name, 'Demo App');
    assert.equal(result.versionCode, 5);
    assert.equal(result.minSdk, 24);
    assert.equal(result.permissions.length, 2);
    assert.deepEqual(result.architectures, ['x86_64']);
    assert.equal(result.frameworks[0], 'native-android');
    assert.equal(result.compatibility, 'limited', 'senza firma APK la compatibilità resta limitata');
    assert.ok(result.compatibilityReasons.some(reason => /firma/i.test(reason)));
    assert.equal(result.iconDataUrl, null);
});

test('APK: legge il manifest anche quando è compresso con deflate', async () => {
    const file = makeFile(buildZip({
        'AndroidManifest.xml': buildManifestXml(),
        'classes.dex': Buffer.from('dex\n035\0fake')
    }, { deflate: ['AndroidManifest.xml'] }), 'compresso.apk');

    const result = await analyzeApk(file);
    assert.equal(result.packageName, 'com.example.demo');
    assert.equal(result.architectures.length, 0);
});

test('APK: rifiuta file che non sono APK', async () => {
    const file = makeFile(Buffer.from('non sono uno zip'), 'finto.apk');
    await assert.rejects(() => analyzeApk(file), /ZIP\/APK valido|ZIP/);
});

test('compatibilità: x86 pronto, ARM limitato, SDK troppo alto bloccato', () => {
    assert.equal(scoreCompatibility({ abis: ['x86_64'] }).level, 'ready');
    assert.equal(scoreCompatibility({ abis: [] }).level, 'ready');
    const arm = scoreCompatibility({ abis: ['arm64-v8a'] });
    assert.equal(arm.level, 'limited');
    assert.match(arm.reasons[0], /ARM/);
    const blocked = scoreCompatibility({ abis: ['x86_64'], minSdk: 99 });
    assert.equal(blocked.level, 'blocked');
});

test('librerie native raggruppate per ABI', () => {
    const libraries = collectNativeLibraries(['lib/arm64-v8a/liba.so', 'lib/arm64-v8a/libb.so', 'lib/x86_64/libc.so', 'classes.dex']);
    assert.deepEqual(libraries['arm64-v8a'], ['liba.so', 'libb.so']);
    assert.deepEqual(libraries.x86_64, ['libc.so']);
});

test('porting: solo APK non è mai convertibile', () => {
    const report = assessPorting({
        analysis: { frameworks: ['flutter'], packageName: 'com.example.demo', versionName: '1.0' }
    });
    assert.equal(report.convertible, false);
    assert.equal(report.mode, 'apk_only');
    assert.equal(report.framework, 'flutter');
    assert.ok(report.blockers.some(item => /manca il codice sorgente/i.test(item)));
    assert.equal(report.apk.packageName, 'com.example.demo');
});

test('porting: progetto Flutter con Xcode è percorribile', () => {
    const report = assessSourcePorting({
        framework: 'flutter', iosProject: true, evidence: ['pubspec.yaml con sezione flutter']
    });
    assert.equal(report.convertible, true);
    assert.ok(['high', 'medium'].includes(report.feasibility));
    assert.ok(report.score > 60);
});

test('porting: progetto sconosciuto resta a bassa fattibilità', () => {
    const report = assessSourcePorting({ framework: 'unknown', iosProject: false });
    assert.equal(report.convertible, false);
    assert.equal(report.feasibility, 'low');
});

test('sorgenti: riconosce Flutter e la presenza del progetto iOS', async () => {
    const archive = buildZip({
        'pubspec.yaml': Buffer.from('name: demo\ndependencies:\n  flutter:\n    sdk: flutter\n'),
        'lib/main.dart': Buffer.from('void main() {}'),
        'ios/Runner.xcodeproj/project.pbxproj': Buffer.from('// pbxproj'),
        'ios/Podfile': Buffer.from("platform :ios, '13.0'")
    }, { deflate: ['pubspec.yaml'] });
    const source = await inspectSourceArchive(makeFile(archive, 'demo-sorgenti.zip'));
    assert.equal(source.framework, 'flutter');
    assert.equal(source.hasIosProject, true);
    assert.ok(source.evidence.length >= 2);
});

test('sorgenti: riconosce React Native dal package.json', async () => {
    const archive = buildZip({
        'package.json': Buffer.from(JSON.stringify({ dependencies: { 'react-native': '0.75.0' } })),
        'App.js': Buffer.from('export default () => null;')
    });
    const source = await inspectSourceArchive(makeFile(archive, 'rn.zip'));
    assert.equal(source.framework, 'react-native');
    assert.equal(source.hasIosProject, false);
});

test('messaggi di errore comprensibili senza database', () => {
    assert.match(appLabErrorMessage({ code: '42P01' }), /migrazione Supabase app_lab/);
    assert.match(appLabErrorMessage({ code: '23505' }), /Sostituisci APK/);
    assert.match(appLabErrorMessage({ message: 'Sessione scaduta' }), /sessione/i);
});

test('formatBytes usa unità italiane', () => {
    assert.equal(formatBytes(512), '512 B');
    assert.equal(formatBytes(2048), '2 KB');
    assert.match(formatBytes(5 * 1024 * 1024), /5 MB/);
});
