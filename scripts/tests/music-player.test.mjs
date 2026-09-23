import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicPlayer } from '../../src/services/musicPlayer.js';
class Media extends EventTarget {
    paused = true; currentTime = 0; calls = 0;
    setAttribute() {} removeAttribute() { this.src = ''; } load() {}
    play() { this.calls++; this.paused = false; this.dispatchEvent(new Event('playing')); return this.result || Promise.resolve(); }
    pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
}
function setup() {
    const elements = [], states = [], revoked = [];
    const player = createMusicPlayer({createAudio: () => {const a = new Media(); elements.push(a); return a;}, onState: s => states.push(s), revokeUrl: s => revoked.push(s)});
    return { player, elements, states, revoked };
}
test('changing tracks releases old audio and blob URLs; stale events cannot advance playlist', () => {
    const {player,elements,revoked,states} = setup(); let ended=0;
    player.select('blob:upload',{onEnd:()=>ended++}); player.select('/audio/tavern.mp3');
    assert.equal(elements[0].paused,true); assert.equal(elements[0].src,''); assert.deepEqual(revoked,['blob:upload']);
    elements[0].dispatchEvent(new Event('ended')); elements[0].dispatchEvent(new Event('error'));
    assert.equal(ended,0); assert.equal(states.at(-1).state,'playing');
});
test('pause/resume and volume do not duplicate playback; stop resets position', () => {
    const {player,elements} = setup(); player.setVolume(.4); player.select('/audio/tavern.mp3');
    player.resume(); assert.equal(elements[0].calls,1); assert.equal(elements[0].volume,.4);
    elements[0].currentTime=7; player.pause(); player.resume(); assert.equal(elements[0].currentTime,7);
    player.stop(); assert.equal(elements[0].currentTime,0); assert.equal(player.getState(),'stopped');
});
test('blocked mobile playback is recoverable by a new gesture', async () => {
    const {player,elements} = setup(); player.select('/audio/tavern.mp3',{autoplay:false});
    elements[0].result=Promise.reject(Object.assign(new Error(),{name:'NotAllowedError'}));
    player.resume(); await Promise.resolve(); assert.equal(player.getState(),'blocked');
    elements[0].paused=true; elements[0].result=Promise.resolve(); player.resume(); assert.equal(player.getState(),'playing');
});
test('a rejection arriving after Stop cannot replace stopped state', async () => {
    const {player,elements} = setup(); player.select('/audio/tavern.mp3',{autoplay:false});
    elements[0].result=Promise.reject(new Error('interrupted')); player.resume(); player.stop(); await Promise.resolve();
    assert.equal(player.getState(),'stopped');
});
