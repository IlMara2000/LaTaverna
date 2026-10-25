import test from 'node:test';
import assert from 'node:assert/strict';
import { usableHandleViewport, constrainHandle } from '../../src/components/layout/floatingHandle.js';
test('installed viewport excludes status bar and home indicator in portrait', () => {
    const view = usableHandleViewport({left:0,top:0,width:402,height:874}, {top:62,bottom:34});
    assert.deepEqual(view, {left:0,top:62,width:402,height:778});
    const handle = constrainHandle(0,0,56,56,view);
    assert.ok(handle.top + 56 > 62);
});
test('landscape safe viewport respects both notch edges and keyboard offset', () => {
    assert.deepEqual(usableHandleViewport({left:0,top:12,width:874,height:300}, {left:59,right:59,bottom:21}), {left:59,top:12,width:756,height:279});
});
test('normal browser dimensions remain unchanged without safe insets', () => {
    const view = {left:0,top:0,width:402,height:874};
    assert.deepEqual(usableHandleViewport(view), view);
});
