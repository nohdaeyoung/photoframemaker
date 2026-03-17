/**
 * exif-page.js — EXIF 프레임 모드 페이지 진입점 (exif.html)
 */

import { ExifApp } from '../modes/exif-mode.js';

window.app = new ExifApp(); // init() is called in AppBase constructor
