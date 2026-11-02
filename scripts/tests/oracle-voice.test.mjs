import test from 'node:test';
import assert from 'node:assert/strict';
import { createOracleVoice, voiceCommand } from '../../src/services/oracleVoice.js';
const settle = () => new Promise(resolve => setTimeout(resolve, 480));
function setup(overrides = {}) {
    const instances = [], requests = [], spoken = [], captions = [];
    class Recognition {
        static available = async () => 'available';
        start() { instances.push(this); queueMicrotask(() => this.onstart?.()); }
        abort() { this.aborted = true; }
        emit(text) { const result = [{ transcript: text }]; result.isFinal = true; this.onresult?.({ resultIndex: 0, results: [result] }); }
    }
    Recognition.prototype.processLocally = false;
    const voice = createOracleVoice({ Recognition, ask: async (text, history) => { requests.push({ text, history }); return { reply: 'Risposta' }; }, speak: async text => spoken.push(text), cancelSpeech() {}, onState() {}, onCaption: text => captions.push(text), ...overrides });
    return { voice, instances, requests, spoken, captions };
}
test('Italian commands tolerate punctuation and case', () => {
    assert.equal(voiceCommand('Oracolo, mi serve il tuo aiuto!'), 'wake');
    assert.equal(voiceCommand('Ciao, non ascoltarmi.'), 'sleep');
    assert.equal(voiceCommand('Oracolo spegniti'), 'off');
    assert.equal(voiceCommand('Come gioco a D&D?'), 'question');
});
test('unsupported browser never attempts remote recognition', async () => {
    const {voice,captions} = setup({ Recognition: undefined });
    await voice.start(); assert.equal(voice.getState(), 'off');
    assert.match(captions.at(-1), /non supporta/);
});
test('waiting discards ambient speech; wake resumes questions with session context', async () => {
    const {voice,instances,requests} = setup();
    await voice.start(); await settle();
    assert.equal(voice.getState(), 'listening');
    assert.equal(instances.at(-1).processLocally, true);
    instances.at(-1).emit('Non ascoltarmi'); await settle();
    assert.equal(voice.getState(), 'waiting');
    instances.at(-1).emit('Conversazione privata');
    assert.equal(requests.length, 0);
    instances.at(-1).emit('Oracolo mi serve il tuo aiuto'); await settle();
    instances.at(-1).emit('Mi chiamo Ada'); await settle();
    instances.at(-1).emit('Come mi chiamo?'); await settle();
    assert.equal(requests[1].history[0].content, 'Mi chiamo Ada');
    instances.at(-1).emit('Oracolo spegniti');
    assert.equal(voice.getState(), 'off'); assert.equal(instances.at(-1).aborted, true);
});
test('stop cancels delayed greetings and late AI responses', async () => {
    let answer;
    const {voice,instances,spoken} = setup({ ask: () => new Promise(resolve => { answer = resolve; }) });
    await voice.start(); voice.stop(); await settle(); assert.equal(spoken.length, 0);
    await voice.start(); await settle();
    instances.at(-1).emit('Domanda'); assert.equal(voice.getState(), 'thinking');
    voice.stop(); answer({reply:'Risposta tardiva'}); await settle();
    assert.equal(spoken.length, 1); assert.equal(voice.getState(), 'off');
});
test('permission denial stops without retrying', async () => {
    const {voice,instances,captions} = setup();
    await voice.start(); await settle();
    instances.at(-1).onerror({error:'not-allowed'});
    assert.equal(voice.getState(), 'off'); assert.match(captions.at(-1), /non autorizzato/);
});
test('stopping during capability check never starts microphone later', async () => {
    let available;
    class PendingRecognition { static available = () => new Promise(resolve => { available = resolve; }); start() { throw new Error('Must never start'); } }
    PendingRecognition.prototype.processLocally = false;
    const {voice} = setup({ Recognition: PendingRecognition });
    const starting = voice.start(); voice.stop(); available('available');
    await starting; assert.equal(voice.getState(), 'off');
});
test('turning off clears conversational memory on next activation', async () => {
    const {voice,instances,requests} = setup();
    await voice.start(); await settle(); instances.at(-1).emit('Ricorda Ada'); await settle();
    voice.stop(); await voice.start(); await settle(); instances.at(-1).emit('Nuova conversazione'); await settle();
    assert.deepEqual(requests[1].history, []); voice.stop();
});
