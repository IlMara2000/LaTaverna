import test from 'node:test';
import assert from 'node:assert/strict';
import {tabletopMediaUrl} from '../../src/services/tabletopMedia.js';
test('shared tabletop rejects executable URLs disguised as PDF maps',()=>{
 for(const url of ['javascript:alert(1)//.pdf','data:text/html,<script>alert(1)</script>#.pdf','file:///etc/passwd','vbscript:msgbox(1)',''])assert.equal(tabletopMediaUrl(url),'');
 assert.equal(tabletopMediaUrl('/maps/table.pdf','https://table.example'),'https://table.example/maps/table.pdf');
 assert.equal(tabletopMediaUrl('https://cdn.example/map.png'),'https://cdn.example/map.png');
});
