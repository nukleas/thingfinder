import { describe, it, expect } from 'vitest';
import { parseYeggiResults } from '../../../src/providers/yeggi.js';

// Trimmed from a live https://www.yeggi.com/q/benchy/ page (2026-11-22).
const item = (id: string, goto: string, title: string, site: string) => `
<div class="item_1_A"> <a href="/goto/${goto}" target="_blank" onclick="javascript:_paq.push(['trackGoal', 4]);">
  <div class="item_2" id="div_${id}_629"><div class="item_2_img_1"><img src="https://img1.yeggi.com/images-3d-model/b83/${id}_x" width="200" height="180" border="0"></div>
  <div class="img-overlay">Download: <i>free</i><br>Website: <i>${site}</i></div></div></a>
  <div class="item_3_B_1"><a href="javascript:void(0);"><div class="txt_more_changer_1_l" title="add to your watchlist">add to list</div></a></div>
  <div class="item_3_B_2" id="${id}_txt"><span class="txt_tag_changer_1">&nbsp;<a href="javascript:void(0);" style="color:#6C6C6C;">Tags</a>&nbsp;</span> ${title}</div>
  <div class="item_3_B_2" style="display:none;" id="${id}_tags"><a href="/q/benchy/">benchy</a></div>
</div>`;

const page = `
<html><head><title>"benchy" 3D Models to Print - yeggi</title></head><body>
<a href="http://twitter.com/yeggi_3d">twitter</a>
${item('7064819', 'abc123=', 'Benchy in a Storm', 'makerworld')}
${item('7273772', 'def456=', 'A Boat Harbor for Benchy &amp; Friends', 'Printables')}
${item('1', 'zzz', '', 'Printables')}
</body></html>`;

describe('parseYeggiResults', () => {
  it('parses result blocks into goto links with title, site and thumbnail', () => {
    const links = parseYeggiResults(page);

    expect(links).toEqual([
      {
        url: 'https://www.yeggi.com/goto/abc123=',
        title: 'Benchy in a Storm',
        site: 'makerworld',
        thumbnailUrl: 'https://img1.yeggi.com/images-3d-model/b83/7064819_x',
      },
      {
        url: 'https://www.yeggi.com/goto/def456=',
        title: 'A Boat Harbor for Benchy & Friends',
        site: 'Printables',
        thumbnailUrl: 'https://img1.yeggi.com/images-3d-model/b83/7273772_x',
      },
    ]);
  });

  it('ignores page chrome like social links', () => {
    expect(parseYeggiResults('<a href="http://twitter.com/yeggi_3d">twitter</a>')).toEqual([]);
  });
});
