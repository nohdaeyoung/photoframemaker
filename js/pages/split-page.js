/**
 * split-page.js — 분할 모드 페이지 진입점 (split.html)
 */

import { SplitApp } from '../modes/split.js';

window.app = new SplitApp(); // init() is called in AppBase constructor
