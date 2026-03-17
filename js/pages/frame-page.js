/**
 * frame-page.js — 프레임 모드 페이지 진입점 (frame.html)
 */

import { FrameApp } from '../modes/frame.js';

window.app = new FrameApp(); // init() is called in AppBase constructor
