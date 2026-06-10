(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const SELECTORS = {
    host: '[data-circuit-bg]',
    main: 'body',
    logo: '.hero-logo img',
  };

  const BREAKPOINTS = {
    mobile: 640,
    tablet: 920,
  };

  const CONFIG = {
    desktop: {
      target: 48,
      minTarget: 40,
      longPassRatio: 0.7,
      preferredOutsideHalo: 150,
      minSpacing: 12,
      nodeEvery: 2,
    },
    tablet: {
      target: 30,
      minTarget: 24,
      longPassRatio: 0.7,
      preferredOutsideHalo: 110,
      minSpacing: 10,
      nodeEvery: 2,
    },
    mobile: {
      target: 16,
      minTarget: 12,
      longPassRatio: 0.68,
      preferredOutsideHalo: 56,
      minSpacing: 8,
      nodeEvery: 3,
    },
  };

  /**
   * @typedef {'mobile' | 'tablet' | 'desktop'} Mode
   * @returns {Mode}
   */
  function getViewportMode() {
    if (window.innerWidth <= BREAKPOINTS.mobile) return 'mobile';
    if (window.innerWidth <= BREAKPOINTS.tablet) return 'tablet';
    return 'desktop';
  }

  /**
   * @returns {boolean}
   */
  function isCircuitDebug() {
    return new URLSearchParams(window.location.search).get('debug') === 'circuit';
  }

  /**
   * @param {number} value
   * @param {number} min
   * @param {number} max
   */
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * @param {number} value
   */
  function round(value) {
    return Math.round(value * 10) / 10;
  }

  /**
   * @param {number} degrees
   */
  function degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  /**
   * @typedef {{x: number, y:number}} Point
   * @param {number} degrees
   * @returns {Point}
   */
  function vectorFromAngle(degrees) {
    const radians = degreesToRadians(degrees);
    return { x: Math.cos(radians), y: Math.sin(radians) };
  }

  /**
   * @param {string} tagName
   * @param {object} attrs
   * @returns {SVGElement | SVGPathElement | SVGCircleElement | SVGRectElement}
   */
  function svgEl(tagName, attrs = {}) {
    const element = document.createElementNS(SVG_NS, tagName);
    Object.entries(attrs).forEach(([name, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        element.setAttribute(name, String(value));
      }
    });
    return element;
  }

  /**
   * @param {HTMLElement} element
   * @param {DOMRect} mainRect
   * @returns {NormalizeRect}
   */
  function rectRelativeToMain(element, mainRect) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return normalizeRect({
      left: rect.left - mainRect.left,
      right: rect.right - mainRect.left,
      top: rect.top - mainRect.top,
      bottom: rect.bottom - mainRect.top,
    });
  }

  /**
   * @typedef {{
   *  x: number,
   *  y: number,
   *  w: number,
   *  h: number,
   *  left: number,
   *  right: number,
   *  top: number,
   *  bottom: number,
   *  cx: number,
   *  cy: number,
   * }} NormalizeRect
   *
   * @param {DOMRect} rect
   * @returns {NormalizeRect}
   */
  function normalizeRect(rect) {
    const left = Math.min(rect.left, rect.right);
    const right = Math.max(rect.left, rect.right);
    const top = Math.min(rect.top, rect.bottom);
    const bottom = Math.max(rect.top, rect.bottom);
    const w = right - left;
    const h = bottom - top;
    return {
      x: left,
      y: top,
      w,
      h,
      left,
      right,
      top,
      bottom,
      cx: left + w / 2,
      cy: top + h / 2,
    };
  }

  /**
   * @param {DOMRect} rect
   * @param {number} amount
   * @returns {NormalizeRect}
   */
  function expandRect(rect, amount) {
    if (!rect) return null;
    return normalizeRect({
      left: rect.left - amount,
      right: rect.right + amount,
      top: rect.top - amount,
      bottom: rect.bottom + amount,
    });
  }

  /**
   * @param {Point} point
   * @param {DOMRect} rect
   * @returns {boolean}
   */
  function pointInsideRect(point, rect) {
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
  }

  /**
   * @param {Point} point
   * @param {DOMRect[]} rects
   * @returns {boolean}
   */
  function pointInsideAnyRect(point, rects) {
    return rects.some((rect) => pointInsideRect(point, rect));
  }

  /**
   * @param {Point} pointA
   * @param {Point} pointB
   * @returns {number}
   */
  function distance(pointA, pointB) {
    return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
  }

  /**
   * @param {Point} point
   * @param {Point} segmentA
   * @param {Point} segmentB
   * @returns {number}
   */
  function distancePointToSegment(point, segmentA, segmentB) {
    const dx = segmentB.x - segmentA.x;
    const dy = segmentB.y - segmentA.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return distance(point, segmentA);
    const t = clamp(((point.x - segmentA.x) * dx + (point.y - segmentA.y) * dy) / lengthSquared, 0, 1);
    return distance(point, { x: segmentA.x + dx * t, y: segmentA.y + dy * t });
  }

  /**
   * @param {Point} a
   * @param {Point} b
   * @param {DOMRect}rect
   * @returns {boolean}
   */
  function segmentIntersectsRect(a, b, rect) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    if (maxX < rect.left || minX > rect.right || maxY < rect.top || minY > rect.bottom) return false;
    if (pointInsideRect(a, rect) || pointInsideRect(b, rect)) return true;

    const corners = [
      { x: rect.left, y: rect.top },
      { x: rect.right, y: rect.top },
      { x: rect.right, y: rect.bottom },
      { x: rect.left, y: rect.bottom },
    ];

    for (let index = 0; index < corners.length; ++index) {
      if (segmentsIntersect(a, b, corners[index], corners[(index + 1) % corners.length])) return true;
    }

    return false;
  }

  /**
   * @param {Point} a
   * @param {Point} b
   */
  function samePoint(a, b) {
    return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
  }

  /**
   * @param {Point} a
   * @param {Point} b
   * @param {Point} c
   * @param {Point} d
   */
  function segmentsIntersect(a, b, c, d) {
    if (samePoint(a, c) || samePoint(a, d) || samePoint(b, c) || samePoint(b, d)) return false;
    const det = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
    if (Math.abs(det) < 0.001) return false;
    const lambda = ((d.y - c.y) * (d.x - a.x) + (c.x - d.x) * (d.y - a.y)) / det;
    const gamma = ((a.y - b.y) * (d.x - a.x) + (b.x - a.x) * (d.y - a.y)) / det;
    return lambda > 0 && lambda < 1 && gamma > 0 && gamma < 1;
  }

  /**
   * @param {Point[]} points
   * @param {DOMRect[]} zones
   * @returns {boolean}
   */
  function routeCrossesProtectedZone(points, zones) {
    for (let index = 0; index < points.length - 1; ++index) {
      for (const zone of zones) {
        if (segmentIntersectsRect(points[index], points[index + 1], zone)) return true;
      }
    }
    return false;
  }

  /**
   * @typedef {{
   *  main: HTMLElement,
   *  mainRect: DOMRect,
   *  logo: HTMLImageElement,
   * }} ElementCollection
   * @returns {ElementCollection}
   */
  function collectElements() {
    const main = document.querySelector(SELECTORS.main);
    return {
      main,
      mainRect: main?.getBoundingClientRect(),
      logo: document.querySelector(SELECTORS.logo),
    };
  }

  /**
   * @typedef {{
   *  x: number,
   *  y: number,
   *  radius: number,
   *  innerRadius: number,
   * }} SourceHalo
   *
   * @param {NormalizeRect} logoRect
   * @param {Mode} mode
   * @returns {SourceHalo}
   */
  function makeSourceHalo(logoRect, mode) {
    const radius = Math.max(logoRect.w, logoRect.h) / 2 + (mode === 'mobile' ? 24 : 34);
    return {
      x: logoRect.cx,
      y: logoRect.cy,
      radius,
      innerRadius: Math.max(logoRect.w, logoRect.h) / 2 + 12,
    };
  }

  /**
   * @typedef {{
   *  width: number,
   *  height: number,
   *  protectedZones: [],
   *  sourceHalo: SourceHalo,
   * }} Geometry
   *
   * @param {Mode} mode
   * @returns {Geometry}
   */
  function measurePageGeometry(mode) {
    const els = collectElements();
    if (!els.main || !els.mainRect || !els.logo) return null;

    const logoRect = rectRelativeToMain(els.logo, els.mainRect);

    // TODO: See if all code related to protectedZones can be deleted
    const protectedZones = [];

    return {
      width: els.mainRect.width,
      height: els.mainRect.height,
      protectedZones,
      sourceHalo: makeSourceHalo(logoRect, mode),
    };
  }

  /**
   * @param {Mode} mode
   * @returns {number[]}
   */
  function makeAngleList(mode) {
    const step = mode === 'mobile' ? 12 : mode === 'tablet' ? 8 : 6;
    const rings = [
      [0, 180, -90, 90],
      [-34, 34, -146, 146],
      [-62, 62, -118, 118],
      [-18, 18, -162, 162],
      [-78, 78, -102, 102],
      [-48, 48, -132, 132],
    ];

    /** @type {number[]} */
    const angles = [];

    /** @type {Set<number>} */
    const seen = new Set();

    rings.flat().forEach((angle) => {
      const snapped = snapAngle(angle, step);
      if (!seen.has(snapped)) {
        seen.add(snapped);
        angles.push(snapped);
      }
    });

    for (let angle = -180 + step; angle < 180; angle += step) {
      const snapped = snapAngle(angle, step);
      if (!seen.has(snapped)) {
        seen.add(snapped);
        angles.push(snapped);
      }
    }

    return angles;
  }

  /**
   * @param {number} angle
   * @param {number} step
   */
  function snapAngle(angle, step) {
    const snapped = Math.round(angle / step) * step;
    if (snapped <= -180) return -180 + step;
    if (snapped >= 180) return 180 - step;
    return snapped;
  }

  /**
   * @typedef {{
   *  angle: number,
   *  length: number,
   *  index: number,
   *  variant: number,
   *  priority: number,
   * }} Spec
   *
   * @param {Mode} mode
   * @returns {Spec[]}
   */
  function makeCandidateSpecs(mode) {
    const lengths = mode === 'mobile'
      ? [300, 260, 220, 184, 152, 124, 100, 82, 72]
      : mode === 'tablet'
        ? [760, 640, 540, 456, 384, 324, 272, 228, 188, 154, 130]
        : [1540, 1320, 1140, 980, 840, 720, 620, 532, 456, 388, 326, 270, 226, 188];

    const angles = makeAngleList(mode);

    /** @type {Spec[]} */
    const specs = [];

    lengths.forEach((length, lengthIndex) => {
      angles.forEach((angle, angleIndex) => {
        specs.push({
          angle,
          length,
          index: specs.length,
          variant: (angleIndex + lengthIndex) % 4,
          priority: lengthIndex * 1000 + angleIndex,
        });
      });
    });

    return specs.sort((a, b) => a.priority - b.priority);
  }

  /**
   * @param {Spec} spec
   * @param {Geometry} geometry
   * @param {Mode} mode
   * @param {boolean} allowShort
   * @returns {Point[]}
   */
  function buildTracePoints(spec, geometry, mode, allowShort = false) {
    const dir = vectorFromAngle(spec.angle);
    const halo = geometry.sourceHalo;
    /** @type {Point} */
    const start = {
      x: halo.x + dir.x * halo.innerRadius,
      y: halo.y + dir.y * halo.innerRadius,
    };

    const endpoint = castEndpoint(start, dir, spec.length, geometry, mode);
    if (!endpoint) return null;
    if (distance(start, endpoint) < (mode === 'mobile' ? 38 : 48)) return null;
    if (!allowShort && endpointDistanceOutsideHalo(endpoint, halo) < CONFIG[mode].preferredOutsideHalo) return null;

    const points = makePleasantPolyline(start, endpoint, dir, spec);
    return points;
  }

  /**
   * @param {Point} endpoint
   * @param {SourceHalo} halo
   * @returns {number}
   */
  function endpointDistanceOutsideHalo(endpoint, halo) {
    return distance(endpoint, halo) - halo.radius;
  }

  /**
   * @param {Point} start
   * @param {Point} dir
   * @param {number} desiredLength
   * @param {Geometry} geometry
   * @param {Mode} mode
   * @returns {Point}
   */
  function castEndpoint(start, dir, desiredLength, geometry, mode) {
    const step = mode === 'mobile' ? 8 : 10;
    const minLength = mode === 'mobile' ? 44 : 54;
    const maxLength = desiredLength;
    /** @type {Point?} */
    let previous = null;

    for (let length = minLength; length <= maxLength; length += step) {
      /** @type {Point} */
      const point = {
        x: start.x + dir.x * length,
        y: start.y + dir.y * length,
      };

      if (point.x < 8 || point.x > geometry.width - 8 || point.y < 8 || point.y > geometry.height - 8) break;
      previous = point;
    }

    return previous;
  }

  /**
   * @param {Point} start
   * @param {Point} endpoint
   * @param {Point} dir
   * @param {Spec} spec
   * @returns {Point[]}
   */
  function makePleasantPolyline(start, endpoint, dir, spec) {
    const perp = { x: -dir.y, y: dir.x };
    const total = distance(start, endpoint);
    if (total < 78) return [start, endpoint];

    const sign = spec.index % 2 === 0 ? 1 : -1;
    const bendOffset = sign * clamp(total * 0.075, 10, 34);
    const chamfer = clamp(total * 0.08, 14, 46);
    const firstRun = clamp(total * 0.24, 34, 118);
    const lastRun = clamp(total * 0.18, 28, 96);

    if (spec.variant === 0) {
      return [
        start,
        {
          x: start.x + dir.x * firstRun,
          y: start.y + dir.y * firstRun,
        },
        {
          x: start.x + dir.x * (firstRun + chamfer) + perp.x * bendOffset,
          y: start.y + dir.y * (firstRun + chamfer) + perp.y * bendOffset,
        },
        {
          x: endpoint.x - dir.x * lastRun + perp.x * bendOffset,
          y: endpoint.y - dir.y * lastRun + perp.y * bendOffset,
        },
        {
          x: endpoint.x - dir.x * clamp(lastRun * 0.45, 12, 34),
          y: endpoint.y - dir.y * clamp(lastRun * 0.45, 12, 34),
        },
        endpoint,
      ];
    }

    if (spec.variant === 1) {
      return [
        start,
        {
          x: start.x + dir.x * total * 0.36,
          y: start.y + dir.y * total * 0.36,
        },
        {
          x: start.x + dir.x * total * 0.52 + perp.x * bendOffset,
          y: start.y + dir.y * total * 0.52 + perp.y * bendOffset,
        },
        {
          x: endpoint.x - dir.x * total * 0.22 + perp.x * bendOffset,
          y: endpoint.y - dir.y * total * 0.22 + perp.y * bendOffset,
        },
        endpoint,
      ];
    }

    if (spec.variant === 2) {
      return [
        start,
        {
          x: start.x + dir.x * total * 0.28,
          y: start.y + dir.y * total * 0.28,
        },
        {
          x: start.x + dir.x * total * 0.64 + perp.x * bendOffset * 0.62,
          y: start.y + dir.y * total * 0.64 + perp.y * bendOffset * 0.62,
        },
        endpoint,
      ];
    }

    return [
      start,
      {
        x: start.x + dir.x * firstRun,
        y: start.y + dir.y * firstRun,
      },
      {
        x: start.x + dir.x * (firstRun + chamfer) - perp.x * bendOffset * 0.72,
        y: start.y + dir.y * (firstRun + chamfer) - perp.y * bendOffset * 0.72,
      },
      {
        x: endpoint.x - dir.x * lastRun - perp.x * bendOffset * 0.72,
        y: endpoint.y - dir.y * lastRun - perp.y * bendOffset * 0.72,
      },
      endpoint,
    ];
  }

  /**
   * @param {Point[]} points
   * @param {Route[]} routes
   * @param {Geometry} geometry
   * @param {Mode} mode
   * @param {number} spacingScale
   * @returns {boolean}
   */
  function routeConflicts(points, routes, geometry, mode, spacingScale = 1) {
    const minSpacing = CONFIG[mode].minSpacing * spacingScale;
    for (const route of routes) {
      const routePieces = route.visibleSegments || [route.points];
      for (const routePiece of routePieces) {
        if (routesIntersectOutsideHalo(points, routePiece, geometry.sourceHalo)) return true;
        if (routesTooCloseOutsideHalo(points, routePiece, geometry.sourceHalo, minSpacing)) return true;
      }
    }
    return false;
  }

  /**
   * @param {Point[]} pointsA
   * @param {Point[]} pointsB
   * @param {SourceHalo} halo
   * @returns {boolean}
   */
  function routesIntersectOutsideHalo(pointsA, pointsB, halo) {
    for (let aIndex = 0; aIndex < pointsA.length - 1; ++aIndex) {
      for (let bIndex = 0; bIndex < pointsB.length - 1; ++bIndex) {
        if (!segmentsIntersect(pointsA[aIndex], pointsA[aIndex + 1], pointsB[bIndex], pointsB[bIndex + 1])) continue;
        const midpoint = {
          x: (pointsA[aIndex].x + pointsA[aIndex + 1].x + pointsB[bIndex].x + pointsB[bIndex + 1].x) / 4,
          y: (pointsA[aIndex].y + pointsA[aIndex + 1].y + pointsB[bIndex].y + pointsB[bIndex + 1].y) / 4,
        };
        if (!pointInsideHalo(midpoint, halo)) return true;
      }
    }
    return false;
  }

  /**
   * @param {Point[]} pointsA
   * @param {Point[]} pointsB
   * @param {SourceHalo} halo
   * @param {number} minSpacing
   * @returns {boolean}
   */
  function routesTooCloseOutsideHalo(pointsA, pointsB, halo, minSpacing) {
    const samplesA = sampleRoute(pointsA, 24).filter((point) => !pointInsideHalo(point, halo));
    const samplesB = sampleRoute(pointsB, 24).filter((point) => !pointInsideHalo(point, halo));

    for (const sampleA of samplesA) {
      for (let index = 0; index < pointsB.length - 1; ++index) {
        if (pointInsideHalo(pointsB[index], halo) && pointInsideHalo(pointsB[index + 1], halo)) continue;
        if (distancePointToSegment(sampleA, pointsB[index], pointsB[index + 1]) < minSpacing) return true;
      }
    }

    for (const sampleB of samplesB) {
      for (let index = 0; index < pointsA.length - 1; ++index) {
        if (pointInsideHalo(pointsA[index], halo) && pointInsideHalo(pointsA[index + 1], halo)) continue;
        if (distancePointToSegment(sampleB, pointsA[index], pointsA[index + 1]) < minSpacing) return true;
      }
    }

    return false;
  }

  /**
   * @param {Point[]} points
   * @param {number} spacing
   * @returns {Point[]}
   */
  function sampleRoute(points, spacing) {
    /** @type {Point[]} */
    const samples = [];
    for (let index = 0; index < points.length - 1; ++index) {
      const a = points[index];
      const b = points[index + 1];
      const segmentLength = distance(a, b);
      const count = Math.max(1, Math.floor(segmentLength / spacing));
      for (let sampleIndex = 0; sampleIndex <= count; ++sampleIndex) {
        const t = sampleIndex / count;
        samples.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    return samples;
  }

  /**
   * @param {Point} point
   * @param {SourceHalo} halo
   * @returns {boolean}
   */
  function pointInsideHalo(point, halo) {
    return distance(point, halo) <= halo.radius;
  }

  /**
   * @param {Point[]} points
   * @param {DOMRect[]} zones
   * @param {Mode} mode
   * @returns {Point[][]}
   */
  function makeVisibleSegments(points, zones, mode) {
    const sampleSpacing = mode === 'mobile' ? 5 : 7;
    const minLength = mode === 'mobile' ? 12 : 18;
    /** @type {Point[][]} */
    const segments = [];
    let current = [];

    for (let index = 0; index < points.length - 1; ++index) {
      const a = points[index];
      const b = points[index + 1];
      const segmentLength = distance(a, b);
      const sampleCount = Math.max(2, Math.ceil(segmentLength / sampleSpacing));

      for (let sampleIndex = 0; sampleIndex <= sampleCount; ++sampleIndex) {
        if (index > 0 && sampleIndex === 0) continue;
        const t = sampleIndex / sampleCount;
        /** @type {Point} */
        const point = {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        };

        if (pointInsideAnyRect(point, zones)) {
          pushVisibleSegment(segments, current, minLength);
          current = [];
          continue;
        }

        current.push(point);
      }
    }

    pushVisibleSegment(segments, current, minLength);
    return segments;
  }

  /**
   * @param {Point[][]} segments
   * @param {Point[]} points
   * @param {number} minLength
   */
  function pushVisibleSegment(segments, points, minLength) {
    if (points.length < 2) return;
    if (routeLength(points) < minLength) return;
    segments.push(simplifyVisibleSegment(points));
  }

  /**
   * @param {Point[]} points
   * @returns {number}
   */
  function routeLength(points) {
    let total = 0;
    for (let index = 0; index < points.length - 1; ++index) {
      total += distance(points[index], points[index + 1]);
    }
    return total;
  }

  /**
   * @param {Point[]} points
   * @returns {Point[]}
   */
  function simplifyVisibleSegment(points) {
    const simplified = [points[0]];
    for (let index = 1; index < points.length - 1; ++index) {
      const previous = simplified[simplified.length - 1];
      const current = points[index];
      const next = points[index + 1];
      const cross = (current.x - previous.x) * (next.y - current.y) - (current.y - previous.y) * (next.x - current.x);
      if (Math.abs(cross) > 0.35 || distance(previous, current) > 46) simplified.push(current);
    }
    simplified.push(points[points.length - 1]);
    return simplified;
  }

  /**
   * @typedef {{
   *  protected: number,
   *  spacing: number,
   *  short: number,
   *  total: number,
   * }} Stats
   *
   * @typedef {{
   *  Route[],
   *  Point[],
   *  stats: Stats,
   * }} Plan
   *
   * @param {Geometry} geometry
   * @param {Mode} mode
   * @returns {Plan}
   */
  function buildTracePlan(geometry, mode) {
    /** @type {Route[]} */
    const routes = [];

    /** @type {Point[]} */
    const endpoints = [];

    const specs = makeCandidateSpecs(mode);
    const target = CONFIG[mode].target;
    const longPassTarget = Math.round(target * CONFIG[mode].longPassRatio);

    /** @type {Stats} */
    const stats = {
      protected: 0,
      spacing: 0,
      short: 0,
      total: specs.length,
    };

    acceptTracePass(specs, {
      allowShort: false,
      target: longPassTarget,
      geometry,
      mode,
      routes,
      endpoints,
      stats,
    });

    acceptTracePass(specs, {
      allowShort: true,
      target,
      geometry,
      mode,
      routes,
      endpoints,
      stats,
    });

    return { routes, endpoints, stats };
  }

  /**
   * @typedef {{
   *  allowShort: boolean,
   *  target: number,
   *  geometry: Geometry,
   *  mode: Mode,
   *  routes: Route[],
   *  endpoints: Point[],
   *  stats: Stats,
   * }} Context
   *
   * @typedef {{
   *  points: Point[],
   *  visibleSegments :Point[][],
   *  kind: RouteKind,
   * }} Route
   *
   * @param {Spec[]} specs
   * @param {Context} context
   */
  function acceptTracePass(specs, context) {
    const { allowShort, target, geometry, mode, routes, endpoints, stats } = context;

    for (const spec of specs) {
      if (routes.length >= target) break;
      const points = buildTracePoints(spec, geometry, mode, allowShort);
      if (!points) {
        if (allowShort) {++stats.protected;}
        else {++stats.short;}
        continue;
      }
      const visibleSegments = makeVisibleSegments(points, geometry.protectedZones, mode);
      if (!visibleSegments.length || visibleSegments.reduce((total, segment) => total + routeLength(segment), 0) < (allowShort ? 34 : 90)) {
        ++stats.protected;
        continue;
      }
      if (visibleSegments.some((segment) => routeConflicts(segment, routes, geometry, mode, allowShort ? 1 : 0.62))) {
        ++stats.spacing;
        continue;
      }

      const route = {
        points,
        visibleSegments,
        kind: routeKind(spec, routes.length),
      };
      routes.push(route);
      endpoints.push(points[points.length - 1]);
    }
  }

  /**
   * @typedef {'primary' | 'secondary' | 'faint'} RouteKind
   * @param {Spec} spec
   * @param {number} index
   * @returns {RouteKind}
   */
  function routeKind(spec, index) {
    if (index % 7 === 0) return 'primary';
    if (spec.length < 120 || index % 3 === 0) return 'secondary';
    return 'faint';
  }

  /**
   * @param {Point[]} points
   * @returns
   */
  function pointsToPath(points) {
    const [first, ...rest] = points;
    return `M ${round(first.x)} ${round(first.y)} ${rest.map((point) => `L ${round(point.x)} ${round(point.y)}`).join(' ')}`;
  }

  /**
   * @param {Point[]} points
   * @param {string} className
   * @param {object} extraAttrs
   * @returns {SVGPathElement}
   */
  function pathEl(points, className, extraAttrs = {}) {
    return svgEl('path', { class: className, d: pointsToPath(points), ...extraAttrs });
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} className
   * @returns {SVGCircleElement}
   */
  function circleEl(x, y, radius, className) {
    return svgEl('circle', { class: className, cx: round(x), cy: round(y), r: radius });
  }

  /**
   * @param {DOMRect} rect
   * @param {string} className
   * @returns {SVGRectElement}
   */
  function rectEl(rect, className) {
    return svgEl('rect', {
      class: className,
      x: round(rect.left),
      y: round(rect.top),
      width: round(rect.right - rect.left),
      height: round(rect.bottom - rect.top),
    });
  }

  /**
   * @param {Plan} plan
   * @param {Geometry} geometry
   * @param {Mode} mode
   * @returns
   */
  function renderCircuitSvg(plan, geometry, mode) {
    /** @type {SVGElement} */
    const svg = svgEl('svg', {
      viewBox: `0 0 ${round(geometry.width)} ${round(geometry.height)}`,
      preserveAspectRatio: 'none',
      focusable: 'false',
    });
    svg.classList.add('circuit-art', `circuit-mode-${mode}`);

    const baseGroup = svgEl('g', { class: 'signal-base' });
    const pulseGroup = svgEl('g', { class: 'signal-pulses' });
    const nodeGroup = svgEl('g', { class: 'signal-nodes' });

    plan.routes.forEach((route, index) => {
      const delayClass = `delay-${index % 8}`;
      route.visibleSegments.forEach((segment) => {
        baseGroup.append(pathEl(segment, `circuit-trace ${route.kind}`));
        pulseGroup.append(pathEl(segment, `circuit-signal ${route.kind} ${delayClass}`, {
          pathLength: '1',
        }));
      });

      if (index % CONFIG[mode].nodeEvery === 0) {
        const lastSegment = route.visibleSegments[route.visibleSegments.length - 1];
        const end = lastSegment[lastSegment.length - 1];
        nodeGroup.append(circleEl(end.x, end.y, route.kind === 'primary' ? 2.7 : 2.1, `circuit-node ${route.kind} ${delayClass}`));
      }
    });

    svg.append(baseGroup, pulseGroup, nodeGroup);

    if (isCircuitDebug()) renderDebugOverlay(svg, geometry, plan);
    return svg;
  }

  /**
   * @param {SVGElement} svg
   * @param {Geometry} geometry
   * @param {Plan} plan
   */
  function renderDebugOverlay(svg, geometry, plan) {
    const debugGroup = svgEl('g', { class: 'circuit-debug-layer' });
    debugGroup.append(circleEl(geometry.sourceHalo.x, geometry.sourceHalo.y, geometry.sourceHalo.radius, 'debug-source-halo'));
    plan.endpoints.forEach((point) => debugGroup.append(circleEl(point.x, point.y, 4, 'debug-terminal')));
    svg.append(debugGroup);
  }

  /**
   * @param {Plan} plan
   * @param {Geometry} geometry
   * @param {Mode} mode
   */
  function mountCircuitDebugPanel(plan, geometry, mode) {
    document.getElementById('circuit-debug-panel')?.remove();
    const panel = document.createElement('div');
    panel.id = 'circuit-debug-panel';
    panel.textContent = [
      mode,
      `routes ${plan.routes.length}`,
      `protected ${plan.stats.protected}`,
      `spacing ${plan.stats.spacing}`,
      `zones ${geometry.protectedZones.length}`,
      `layer ${Math.round(geometry.width)}x${Math.round(geometry.height)}`,
    ].join(' | ');
    panel.setAttribute('style', 'position:fixed;right:8px;bottom:8px;z-index:9999;max-width:min(92vw,760px);background:rgba(7,17,31,.9);color:#fff;font:12px/1.4 monospace;padding:6px 8px;border-radius:4px;pointer-events:none;');
    document.body.append(panel);
  }

  class GraNetCircuit {
    constructor() {
      /** @type {number?} */
      this.resizeTimer = null;

      /** @type {number} */
      this.viewportWidth = 0;

      /** @type {number} */
      this.viewportHeight = 0;
    }

    init() {
      const host = document.querySelector(SELECTORS.host);
      if (!host) return;
      if (this.initialized) {
        if (!this.host?.firstChild) {this.mount();}
        return;
      }

      /** @type {HTMLElement} */
      this.host = host;

      /** @type {boolean} */
      this.initialized = true;

      this.mount();
      window.addEventListener('resize', () => this.scheduleMount(), { passive: true });
    }

    scheduleMount() {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => this.mount(), 120);
    }

    mount() {
      if (this.viewportWidth === window.innerWidth && this.viewportHeight === window.innerHeight && this.host?.firstChild) {
        return;
      }

      const mode = getViewportMode();
      const geometry = measurePageGeometry(mode);
      if (!geometry) return;
      const plan = buildTracePlan(geometry, mode);
      const svg = renderCircuitSvg(plan, geometry, mode);
      this.host.replaceChildren(svg);
      this.freezeLayerSize(geometry);
      this.viewportWidth = window.innerWidth;
      this.viewportHeight = window.innerHeight;
      this.host.classList.toggle('circuit-debug', isCircuitDebug());
      if (isCircuitDebug()) mountCircuitDebugPanel(plan, geometry, mode);
      else document.getElementById('circuit-debug-panel')?.remove();
    }

    /**
     * @param {Geometry} geometry
     */
    freezeLayerSize(geometry) {
      this.host.style.bottom = 'auto';
      this.host.style.height = `${Math.ceil(geometry.height)}px`;
    }
  }

  const circuit = new GraNetCircuit();

  window.GraNetCircuit = {
    init() {
      circuit.init();
    },
  };
})();

window.GraNetCircuit?.init();
