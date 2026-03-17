/**
 * convert-page.js — 변환 모드 페이지 진입점 (convert.html)
 */

import { ConvertApp } from '../modes/convert.js';

window.app = new ConvertApp(); // init() is called in AppBase constructor
