/**
 * PORTING iOS — valutazione di fattibilità e riconoscimento progetti.
 *
 * Regola non negoziabile: un file .ipa ha senso solo dopo una compilazione
 * Xcode riuscita e firmata. Qui produciamo analisi, non promesse: la funzione
 * dice cosa è riutilizzabile, cosa va riscritto e cosa manca.
 */

import { openApkZip } from './apk.js';

export const FRAMEWORK_LABELS = {
    flutter: 'Flutter',
    'react-native': 'React Native',
    unity: 'Unity',
    capacitor: 'Capacitor / Ionic',
    cordova: 'Cordova / PhoneGap',
    'native-android': 'Android nativo (Java/Kotlin)',
    unknown: 'Non riconosciuto'
};

const APPLE_REQUIREMENTS = [
    'Mac con macOS e Xcode aggiornato (le build iOS non si producono su Vercel o Linux).',
    'Apple Developer Program attivo per firmare e distribuire l’app.',
    'Certificato di firma e provisioning profile validi per il bundle identifier scelto.',
    'App Store Connect configurato per TestFlight o distribuzione, se l’app è destinata al pubblico.'
];

const COMMON_BLOCKERS = [
    'Un APK compilato non contiene il codice sorgente: non è tecnicamente convertibile in un .ipa autentico.',
    'I servizi Google Play (billing, mappe, push, login) non esistono su iOS e vanno sostituiti.',
    'I permessi e i sensori Android non hanno sempre un equivalente Apple: alcune funzioni richiedono una riscrittura.',
    'La replica 1:1 dell’interfaccia viola spesso la linea guida App Store 4.2 (funzionalità minima): serve un’app iOS nativa e sensata.'
];

const frameworkAssessment = (frameworks, hasNativeLibs) => {
    const primary = ['flutter', 'react-native', 'unity', 'capacitor', 'cordova']
        .find(name => frameworks.includes(name)) || 'native-android';
    const table = {
        flutter: {
            score: 78,
            reusable: ['Interfaccia in Dart: spesso ricompilabile su iOS senza riscrittura.', 'Asset, font e localizzazioni.', 'Logica di business senza plugin nativi.'],
            rewrite: ['Plugin Flutter senza implementazione iOS.', 'Eventuali canali nativi specifici Android (MethodChannel).'],
            notes: ['Serve la cartella ios/ del progetto, altrimenti `flutter create .` rigenera il runner.']
        },
        'react-native': {
            score: 70,
            reusable: ['Componenti React e bundle JavaScript.', 'Logica di stato e chiamate API.', 'Asset condivisi.'],
            rewrite: ['Moduli nativi Android-only e permessi.', 'API specifiche di Android (intent, servizi in background).'],
            notes: ['Serve Podfile/CocoaPods e Xcode; Expo può usare EAS Build con un account Apple.']
        },
        unity: {
            score: 55,
            reusable: ['Scene, script C#, asset e animazioni.', 'Logica di gioco indipendente dalla piattaforma.'],
            rewrite: ['Plugin nativi Android e integrazioni SDK.', 'Input, risoluzione e licenza Unity iOS.'],
            notes: ['Servono Unity con modulo iOS installato e licenza valida.']
        },
        capacitor: {
            score: 66,
            reusable: ['Interfaccia web (HTML/CSS/JS) e logica.', 'Plugin Capacitor con supporto iOS.'],
            rewrite: ['Plugin solo Android e API browser non disponibili in WKWebView.'],
            notes: ['`npx cap add ios` crea il progetto Xcode; poi build e firma con Xcode.']
        },
        cordova: {
            score: 58,
            reusable: ['Contenuto web e plugin con supporto iOS.'],
            rewrite: ['Plugin Cordova abbandonati o solo Android.', 'Configurazione della piattaforma iOS.'],
            notes: ['La piattaforma iOS va rigenerata e i plugin verificati uno a uno.']
        },
        'native-android': {
            score: 18,
            reusable: ['Grafica, testi, audio e asset (da verificare come diritti).', 'Contratti e documentazione delle API.'],
            rewrite: ['Tutta l’interfaccia in SwiftUI/UIKit.', 'Activity, Service, BroadcastReceiver, permessi, storage e lifecycle.', 'Eventuali parti Kotlin/Java da tradurre in Swift.'],
            notes: ['È un nuovo sviluppo iOS, non una conversione automatica.']
        }
    };
    const base = { ...table[primary], framework: primary, label: FRAMEWORK_LABELS[primary] };
    if (hasNativeLibs && primary === 'native-android') base.score = Math.max(10, base.score - 6);
    return base;
};

/**
 * Valutazione a partire dall'analisi APK già salvata.
 * Restituisce sempre `convertible: false` per il caso A: nessun .ipa senza sorgenti.
 */
export function assessPorting(app) {
    const analysis = app?.analysis || {};
    const frameworks = Array.isArray(analysis.frameworks) && analysis.frameworks.length
        ? analysis.frameworks
        : ['native-android'];
    const nativeLibraries = analysis.nativeLibraries || {};
    const hasNativeLibs = Object.values(nativeLibraries).some(list => list.length);
    const assessment = frameworkAssessment(frameworks, hasNativeLibs);
    const apkOnly = {
        mode: 'apk_only',
        feasibility: 'very_low',
        score: Math.min(35, Math.round(assessment.score * 0.4)),
        convertible: false,
        framework: assessment.framework,
        frameworkLabel: assessment.label,
        reusable: assessment.reusable.filter(item => /asset|grafic|testi|audio|documentazione/i.test(item)),
        rewrite: assessment.rewrite,
        blockers: [
            'Disponibile solo l’APK: manca il codice sorgente e non esiste un percorso automatico APK → IPA.',
            ...COMMON_BLOCKERS
        ],
        notes: [
            ...assessment.notes,
            'Alternativa immediata: eseguire l’app Android online nell’ambiente remoto di APP LAB.'
        ],
        requirements: APPLE_REQUIREMENTS,
        estimate: 'Settimane o mesi, in funzione della complessità dell’app e delle integrazioni Android.'
    };
    return { ...apkOnly, apk: { packageName: analysis.packageName, versionName: analysis.versionName } };
}

/** Valutazione per il caso B, dopo il riconoscimento del progetto caricato. */
export function assessSourcePorting(source) {
    const framework = source?.framework || 'unknown';
    const assessment = framework === 'unknown'
        ? {
            framework, score: 20,
            reusable: ['Asset e risorse grafiche, dopo verifica delle licenze.'],
            rewrite: ['Struttura del progetto e interfaccia.', 'Logica applicativa da tradurre.'],
            notes: ['Il framework non è stato riconosciuto: serve una revisione manuale del progetto.']
        }
        : frameworkAssessment(framework === 'android-native' ? ['native-android'] : [framework], false);

    const hasIosProject = Boolean(source?.iosProject);
    const score = Math.max(5, Math.min(95, assessment.score + (hasIosProject ? 12 : 0) - (framework === 'unknown' ? 15 : 0)));
    const blockers = [...COMMON_BLOCKERS.slice(2)];
    if (!hasIosProject && framework === 'flutter') blockers.push('Manca la cartella ios/: va rigenerata con Flutter prima della build.');
    if (!hasIosProject && framework === 'react-native') blockers.push('Manca la cartella ios/: CocoaPods e Xcode devono essere inizializzati.');
    if (framework === 'unknown') blockers.push('Progetto non riconosciuto: serve una valutazione manuale prima di qualsiasi build.');

    return {
        mode: 'source',
        framework,
        frameworkLabel: FRAMEWORK_LABELS[framework] || FRAMEWORK_LABELS.unknown,
        feasibility: score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low',
        score,
        convertible: score >= 45,
        hasIosProject,
        reusable: assessment.reusable,
        rewrite: assessment.rewrite,
        blockers,
        notes: [
            ...(assessment.notes || []),
            hasIosProject
                ? 'Il progetto iOS è già presente nell’archivio: si parte dalla pipeline Xcode esistente.'
                : 'Il progetto iOS non è presente: la build richiede la generazione della piattaforma iOS.'
        ],
        requirements: APPLE_REQUIREMENTS,
        estimate: score >= 70
            ? 'Giorni per una build di prova, settimane per completare test e distribuzione.'
            : 'Settimane di lavoro manuale, con verifica funzionale su dispositivo reale.'
    };
}

const readText = async (zip, name, max = 200000) => {
    if (!zip.has(name)) return null;
    const bytes = await zip.read(name);
    if (!bytes) return null;
    return new TextDecoder('utf-8').decode(bytes.subarray(0, max));
};

/**
 * Riconosce il framework e la presenza di un progetto iOS in un archivio sorgente.
 * Legge soltanto pochi file di configurazione, non l'intero progetto.
 */
export async function inspectSourceArchive(file) {
    if (!file) throw new Error('Nessun archivio selezionato.');
    if (!/\.(zip)$/i.test(file.name || '')) throw new Error('Carica un archivio .zip del progetto sorgente.');
    if (!file.size) throw new Error('L’archivio è vuoto.');
    if (file.size > 500 * 1024 * 1024) throw new Error('L’archivio supera il limite di 500 MB.');

    const zip = await openApkZip(file, { requireManifest: false });
    const names = zip.names;
    const has = pattern => names.some(name => pattern.test(name));
    const evidence = [];
    let framework = 'unknown';

    const pubspec = await readText(zip, 'pubspec.yaml');
    const packageJsonRaw = await readText(zip, 'package.json');
    let packageJson = null;
    if (packageJsonRaw) {
        try { packageJson = JSON.parse(packageJsonRaw); } catch { /* non è JSON valido */ }
    }
    const dependencies = { ...(packageJson?.dependencies || {}), ...(packageJson?.devDependencies || {}) };

    if (pubspec && /(^|\n)\s*flutter\s*:/.test(pubspec)) {
        framework = 'flutter';
        evidence.push('pubspec.yaml con sezione flutter');
        const nameMatch = /^name:\s*(.+)$/m.exec(pubspec);
        if (nameMatch) evidence.push(`package Flutter: ${nameMatch[1].trim()}`);
    } else if (dependencies['react-native'] || dependencies.expo || has(/^android\/app\/src\/main\/java\/.*MainApplication\.(java|kt)$/)) {
        if (dependencies['react-native'] || dependencies.expo) {
            framework = 'react-native';
            evidence.push(`package.json con ${dependencies.expo ? 'Expo' : 'React Native'}`);
        }
    } else if (has(/(^|\/)ProjectSettings\/ProjectVersion\.txt$/) || has(/^Assets\//)) {
        framework = 'unity';
        evidence.push('Struttura di progetto Unity (Assets/ e ProjectSettings/)');
    } else if (dependencies['@capacitor/core'] || has(/^capacitor\.config\.(ts|js|json)$/)) {
        framework = 'capacitor';
        evidence.push('Configurazione Capacitor');
    } else if (has(/^config\.xml$/) && has(/^www\//)) {
        framework = 'cordova';
        evidence.push('config.xml e cartella www/ (Cordova)');
    } else if (has(/^android\/app\/build\.gradle(\.kts)?$/) || has(/^app\/build\.gradle(\.kts)?$/)) {
        framework = 'android-native';
        evidence.push('Modulo Gradle Android');
    }

    const hasIosProject = has(/\.xcodeproj\/project\.pbxproj$/);
    const hasPodfile = has(/(^|\/)Podfile$/);
    const hasAndroidProject = has(/^android\/app\/build\.gradle(\.kts)?$/) || has(/^app\/build\.gradle(\.kts)?$/);
    if (hasIosProject) evidence.push('Progetto Xcode (.xcodeproj) presente');
    if (hasPodfile) evidence.push('Podfile CocoaPods presente');

    const bundleId = /applicationId\s*[=:]\s*["']([\w.]+)["']/.exec(await readText(zip, 'android/app/build.gradle')
        || await readText(zip, 'app/build.gradle') || '')?.[1] || null;

    return {
        file,
        framework,
        frameworkLabel: FRAMEWORK_LABELS[framework] || FRAMEWORK_LABELS.unknown,
        confidence: framework === 'unknown' ? 'low' : evidence.length > 2 ? 'high' : 'medium',
        evidence,
        hasIosProject,
        hasPodfile,
        hasAndroidProject,
        bundleId,
        entryCount: names.length,
        sizeBytes: file.size
    };
}

/** Riepilogo leggibile per la UI e per il report salvato. */
export function portingSummary(report) {
    const pieces = [];
    if (report.convertible) pieces.push('Percorso di build iOS tecnicamente percorribile.');
    else pieces.push('Conversione automatica non disponibile.');
    if (report.blockers?.length) pieces.push(`${report.blockers.length} blocchi da risolvere.`);
    if (report.hasIosProject) pieces.push('Progetto Xcode già presente.');
    return pieces.join(' ');
}
