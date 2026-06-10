(() => {
  'use strict';

  const TRACE_VERSION = 'trace-hero-signal-field-v12';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const SELECTORS = {
    host: '[data-circuit-bg]',
    main: '#main',
    header: '.site-header',
    logo: '.hero-mark img',
    heroCopy: '.hero-copy',
    heroTextContent: '.hero-brand, .hero h1, .hero-text',
    ctaRow: '.hero-contact',
    ctaItems: '.hero-contact a',
    servicesHeading: '.switcher-heading h2',
    serviceTabs: '.panel-tabs',
    serviceTabItems: '.panel-tab',
    servicePanel: '.info-panel.open',
    panelContent: '.info-panel.open .panel-intro h3, .info-panel.open .panel-intro p, .info-panel.open .price-range, .info-panel.open h4, .info-panel.open .plan-price, .info-panel.open .price-list, .info-panel.open .inline-contact strong, .info-panel.open .inline-contact-actions, .info-panel.open .contact-card strong, .info-panel.open .contact-card-actions, .info-panel.open .contact-form label, .info-panel.open .form-submit, .info-panel.open .form-helper',
    footer: 'footer',
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
      branchEvery: 5,
      nodeEvery: 2,
    },
    tablet: {
      target: 30,
      minTarget: 24,
      longPassRatio: 0.7,
      preferredOutsideHalo: 110,
      minSpacing: 10,
      branchEvery: 6,
      nodeEvery: 2,
    },
    mobile: {
      target: 16,
      minTarget: 12,
      longPassRatio: 0.68,
      preferredOutsideHalo: 56,
      minSpacing: 8,
      branchEvery: 7,
      nodeEvery: 3,
    },
  };

  function getViewportMode() {
    if (window.innerWidth <= BREAKPOINTS.mobile) return 'mobile';
    if (window.innerWidth <= BREAKPOINTS.tablet) return 'tablet';
    return 'desktop';
  }

  function isCircuitDebug() {
    return new URLSearchParams(window.location.search).get('debug') === 'circuit';
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round(value) {
    return Math.round(value * 10) / 10;
  }

  function degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  function vectorFromAngle(degrees) {
    const radians = degreesToRadians(degrees);
    return { x: Math.cos(radians), y: Math.sin(radians) };
  }

  function svgEl(tagName, attrs = {}) {
    const element = document.createElementNS(SVG_NS, tagName);
    Object.entries(attrs).forEach(([name, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        element.setAttribute(name, String(value));
      }
    });
    return element;
  }

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

  function textRectRelativeToMain(element, mainRect) {
    if (!element || !element.firstChild) return rectRelativeToMain(element, mainRect);
    const range = document.createRange();
    range.selectNodeContents(element);
    const rect = range.getBoundingClientRect();
    range.detach();
    if (!rect.width || !rect.height) return rectRelativeToMain(element, mainRect);
    return normalizeRect({
      left: rect.left - mainRect.left,
      right: rect.right - mainRect.left,
      top: rect.top - mainRect.top,
      bottom: rect.bottom - mainRect.top,
    });
  }

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

  function expandRect(rect, amount) {
    if (!rect) return null;
    return normalizeRect({
      left: rect.left - amount,
      right: rect.right + amount,
      top: rect.top - amount,
      bottom: rect.bottom + amount,
    });
  }

  function pointInsideRect(point, rect) {
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
  }

  function pointInsideAnyRect(point, rects) {
    return rects.some((rect) => pointInsideRect(point, rect));
  }

  function distance(pointA, pointB) {
    return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
  }

  function distancePointToSegment(point, segmentA, segmentB) {
    const dx = segmentB.x - segmentA.x;
    const dy = segmentB.y - segmentA.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return distance(point, segmentA);
    const t = clamp(((point.x - segmentA.x) * dx + (point.y - segmentA.y) * dy) / lengthSquared, 0, 1);
    return distance(point, { x: segmentA.x + dx * t, y: segmentA.y + dy * t });
  }

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

    for (let index = 0; index < corners.length; index += 1) {
      if (segmentsIntersect(a, b, corners[index], corners[(index + 1) % corners.length])) return true;
    }

    return false;
  }

  function samePoint(a, b) {
    return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
  }

  function segmentsIntersect(a, b, c, d) {
    if (samePoint(a, c) || samePoint(a, d) || samePoint(b, c) || samePoint(b, d)) return false;
    const det = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
    if (Math.abs(det) < 0.001) return false;
    const lambda = ((d.y - c.y) * (d.x - a.x) + (c.x - d.x) * (d.y - a.y)) / det;
    const gamma = ((a.y - b.y) * (d.x - a.x) + (b.x - a.x) * (d.y - a.y)) / det;
    return lambda > 0 && lambda < 1 && gamma > 0 && gamma < 1;
  }

  function routeCrossesProtectedZone(points, zones) {
    for (let index = 0; index < points.length - 1; index += 1) {
      for (const zone of zones) {
        if (segmentIntersectsRect(points[index], points[index + 1], zone)) return true;
      }
    }
    return false;
  }

  function collectElements() {
    const main = document.querySelector(SELECTORS.main);
    return {
      main,
      mainRect: main?.getBoundingClientRect(),
      header: document.querySelector(SELECTORS.header),
      logo: document.querySelector(SELECTORS.logo),
      heroCopy: document.querySelector(SELECTORS.heroCopy),
      heroTextContent: Array.from(document.querySelectorAll(SELECTORS.heroTextContent)),
      ctaRow: document.querySelector(SELECTORS.ctaRow),
      ctaItems: Array.from(document.querySelectorAll(SELECTORS.ctaItems)),
      servicesHeading: document.querySelector(SELECTORS.servicesHeading),
      serviceTabs: document.querySelector(SELECTORS.serviceTabs),
      serviceTabItems: Array.from(document.querySelectorAll(SELECTORS.serviceTabItems)),
      servicePanel: document.querySelector(SELECTORS.servicePanel),
      panelContent: Array.from(document.querySelectorAll(SELECTORS.panelContent)),
      footer: document.querySelector(SELECTORS.footer),
    };
  }

  function rectsFor(elements, mainRect) {
    return elements.map((element) => rectRelativeToMain(element, mainRect)).filter(Boolean);
  }

  function makeSourceHalo(logoRect, mode) {
    const radius = Math.max(logoRect.w, logoRect.h) / 2 + (mode === 'mobile' ? 24 : 34);
    return {
      x: logoRect.cx,
      y: logoRect.cy,
      radius,
      innerRadius: Math.max(logoRect.w, logoRect.h) / 2 + 12,
    };
  }

  function measurePageGeometry(mode) {
    const els = collectElements();
    if (!els.main || !els.mainRect) return null;
    if (!els.logo) return null;

    const rects = {
      main: els.mainRect,
      header: rectRelativeToMain(els.header, els.mainRect),
      logo: rectRelativeToMain(els.logo, els.mainRect),
      heroCopy: rectRelativeToMain(els.heroCopy, els.mainRect),
      heroTextContent: rectsFor(els.heroTextContent, els.mainRect),
      ctaRow: rectRelativeToMain(els.ctaRow, els.mainRect),
      ctaItems: rectsFor(els.ctaItems, els.mainRect),
      servicesHeading: textRectRelativeToMain(els.servicesHeading, els.mainRect),
      serviceTabs: rectRelativeToMain(els.serviceTabs, els.mainRect),
      serviceTabItems: rectsFor(els.serviceTabItems, els.mainRect),
      servicePanel: rectRelativeToMain(els.servicePanel, els.mainRect),
      panelContent: rectsFor(els.panelContent, els.mainRect),
      footer: rectRelativeToMain(els.footer, els.mainRect),
    };

    const protectedZones = [
      expandRect(rects.header, 8),
      ...rects.heroTextContent.map((rect) => expandRect(rect, 8)),
      ...rects.ctaItems.map((rect) => expandRect(rect, 6)),
      expandRect(rects.servicesHeading, 2),
      ...rects.serviceTabItems.map((rect) => expandRect(rect, 8)),
      ...rects.panelContent.map((rect) => expandRect(rect, 6)),
      expandRect(rects.footer, 12),
    ].filter((rect) => rect && rect.w > 0 && rect.h > 0);

    return {
      width: els.mainRect.width,
      height: els.mainRect.height,
      rects,
      protectedZones,
      sourceHalo: makeSourceHalo(rects.logo, mode),
    };
  }

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
    const angles = [];
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

  function snapAngle(angle, step) {
    const snapped = Math.round(angle / step) * step;
    if (snapped <= -180) return -180 + step;
    if (snapped >= 180) return 180 - step;
    return snapped;
  }

  function makeCandidateSpecs(mode) {
    const lengths = mode === 'mobile'
      ? [300, 260, 220, 184, 152, 124, 100, 82, 72]
      : mode === 'tablet'
        ? [760, 640, 540, 456, 384, 324, 272, 228, 188, 154, 130]
        : [1540, 1320, 1140, 980, 840, 720, 620, 532, 456, 388, 326, 270, 226, 188];
    const angles = makeAngleList(mode);
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

  function buildTracePoints(spec, geometry, mode, options = {}) {
    const dir = vectorFromAngle(spec.angle);
    const halo = geometry.sourceHalo;
    const start = {
      x: halo.x + dir.x * halo.innerRadius,
      y: halo.y + dir.y * halo.innerRadius,
    };

    const endpoint = castEndpoint(start, dir, spec.length, geometry, mode);
    if (!endpoint) return null;
    if (distance(start, endpoint) < (mode === 'mobile' ? 38 : 48)) return null;
    if (!options.allowShort && endpointDistanceOutsideHalo(endpoint, halo) < CONFIG[mode].preferredOutsideHalo) return null;

    const points = makePleasantPolyline(start, endpoint, dir, spec);
    return points;
  }

  function endpointDistanceOutsideHalo(endpoint, halo) {
    return distance(endpoint, halo) - halo.radius;
  }

  function castEndpoint(start, dir, desiredLength, geometry, mode) {
    const step = mode === 'mobile' ? 8 : 10;
    const minLength = mode === 'mobile' ? 44 : 54;
    const maxLength = desiredLength;
    let previous = null;

    for (let length = minLength; length <= maxLength; length += step) {
      const point = {
        x: start.x + dir.x * length,
        y: start.y + dir.y * length,
      };

      if (point.x < 8 || point.x > geometry.width - 8 || point.y < 8 || point.y > geometry.height - 8) break;
      previous = point;
    }

    return previous;
  }

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

  function routesIntersectOutsideHalo(pointsA, pointsB, halo) {
    for (let aIndex = 0; aIndex < pointsA.length - 1; aIndex += 1) {
      for (let bIndex = 0; bIndex < pointsB.length - 1; bIndex += 1) {
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

  function routesTooCloseOutsideHalo(pointsA, pointsB, halo, minSpacing) {
    const samplesA = sampleRoute(pointsA, 24).filter((point) => !pointInsideHalo(point, halo));
    const samplesB = sampleRoute(pointsB, 24).filter((point) => !pointInsideHalo(point, halo));

    for (const sampleA of samplesA) {
      for (let index = 0; index < pointsB.length - 1; index += 1) {
        if (pointInsideHalo(pointsB[index], halo) && pointInsideHalo(pointsB[index + 1], halo)) continue;
        if (distancePointToSegment(sampleA, pointsB[index], pointsB[index + 1]) < minSpacing) return true;
      }
    }

    for (const sampleB of samplesB) {
      for (let index = 0; index < pointsA.length - 1; index += 1) {
        if (pointInsideHalo(pointsA[index], halo) && pointInsideHalo(pointsA[index + 1], halo)) continue;
        if (distancePointToSegment(sampleB, pointsA[index], pointsA[index + 1]) < minSpacing) return true;
      }
    }

    return false;
  }

  function sampleRoute(points, spacing) {
    const samples = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      const a = points[index];
      const b = points[index + 1];
      const segmentLength = distance(a, b);
      const count = Math.max(1, Math.floor(segmentLength / spacing));
      for (let sampleIndex = 0; sampleIndex <= count; sampleIndex += 1) {
        const t = sampleIndex / count;
        samples.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    return samples;
  }

  function pointInsideHalo(point, halo) {
    return distance(point, halo) <= halo.radius;
  }

  function addBranchStub(route, routeIndex, geometry, mode) {
    if (routeIndex % CONFIG[mode].branchEvery !== 0 || route.points.length < 2) return null;
    const segmentStart = route.points[Math.max(0, route.points.length - 2)];
    const segmentEnd = route.points[route.points.length - 1];
    const dx = segmentEnd.x - segmentStart.x;
    const dy = segmentEnd.y - segmentStart.y;
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength < 60) return null;

    const unit = { x: dx / segmentLength, y: dy / segmentLength };
    const perp = { x: -unit.y, y: unit.x };
    const base = {
      x: segmentStart.x + dx * 0.62,
      y: segmentStart.y + dy * 0.62,
    };
    const sign = routeIndex % 2 === 0 ? 1 : -1;
    const length = mode === 'mobile' ? 18 : 28;
    const branch = [
      base,
      { x: base.x + perp.x * sign * length, y: base.y + perp.y * sign * length },
    ];

    if (routeCrossesProtectedZone(branch, geometry.protectedZones)) return null;
    if (branch[1].x < 0 || branch[1].x > geometry.width || branch[1].y < 0 || branch[1].y > geometry.height) return null;
    return branch;
  }

  function makeVisibleSegments(points, zones, mode) {
    const sampleSpacing = mode === 'mobile' ? 5 : 7;
    const minLength = mode === 'mobile' ? 12 : 18;
    const segments = [];
    let current = [];

    for (let index = 0; index < points.length - 1; index += 1) {
      const a = points[index];
      const b = points[index + 1];
      const segmentLength = distance(a, b);
      const sampleCount = Math.max(2, Math.ceil(segmentLength / sampleSpacing));

      for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
        if (index > 0 && sampleIndex === 0) continue;
        const t = sampleIndex / sampleCount;
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

  function pushVisibleSegment(segments, points, minLength) {
    if (points.length < 2) return;
    if (routeLength(points) < minLength) return;
    segments.push(simplifyVisibleSegment(points));
  }

  function routeLength(points) {
    let total = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      total += distance(points[index], points[index + 1]);
    }
    return total;
  }

  function simplifyVisibleSegment(points) {
    const simplified = [points[0]];
    for (let index = 1; index < points.length - 1; index += 1) {
      const previous = simplified[simplified.length - 1];
      const current = points[index];
      const next = points[index + 1];
      const cross = (current.x - previous.x) * (next.y - current.y) - (current.y - previous.y) * (next.x - current.x);
      if (Math.abs(cross) > 0.35 || distance(previous, current) > 46) simplified.push(current);
    }
    simplified.push(points[points.length - 1]);
    return simplified;
  }

  function buildTracePlan(geometry, mode) {
    const routes = [];
    const endpoints = [];
    const specs = makeCandidateSpecs(mode);
    const target = CONFIG[mode].target;
    const longPassTarget = Math.round(target * CONFIG[mode].longPassRatio);
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

  function acceptTracePass(specs, context) {
    const { allowShort, target, geometry, mode, routes, endpoints, stats } = context;

    for (const spec of specs) {
      if (routes.length >= target) break;
      const points = buildTracePoints(spec, geometry, mode, { allowShort });
      if (!points) {
        if (allowShort) stats.protected += 1;
        else stats.short += 1;
        continue;
      }
      const visibleSegments = makeVisibleSegments(points, geometry.protectedZones, mode);
      if (!visibleSegments.length || visibleSegments.reduce((total, segment) => total + routeLength(segment), 0) < (allowShort ? 34 : 90)) {
        stats.protected += 1;
        continue;
      }
      if (visibleSegments.some((segment) => routeConflicts(segment, routes, geometry, mode, allowShort ? 1 : 0.62))) {
        stats.spacing += 1;
        continue;
      }

      const route = {
        points,
        visibleSegments,
        kind: routeKind(spec, routes.length),
        branch: null,
      };
      route.branch = addBranchStub(route, routes.length, geometry, mode);
      routes.push(route);
      endpoints.push(points[points.length - 1]);
    }
  }

  function routeKind(spec, index) {
    if (index % 7 === 0) return 'primary';
    if (spec.length < 120 || index % 3 === 0) return 'secondary';
    return 'faint';
  }

  function pointsToPath(points) {
    const [first, ...rest] = points;
    return `M ${round(first.x)} ${round(first.y)} ${rest.map((point) => `L ${round(point.x)} ${round(point.y)}`).join(' ')}`;
  }

  function pathEl(points, className, extraAttrs = {}) {
    return svgEl('path', { class: className, d: pointsToPath(points), ...extraAttrs });
  }

  function circleEl(x, y, radius, className) {
    return svgEl('circle', { class: className, cx: round(x), cy: round(y), r: radius });
  }

  function rectEl(rect, className) {
    return svgEl('rect', {
      class: className,
      x: round(rect.left),
      y: round(rect.top),
      width: round(rect.right - rect.left),
      height: round(rect.bottom - rect.top),
    });
  }

  function renderCircuitSvg(plan, geometry, mode) {
    const svg = svgEl('svg', {
      viewBox: `0 0 ${round(geometry.width)} ${round(geometry.height)}`,
      preserveAspectRatio: 'none',
      focusable: 'false',
    });
    svg.classList.add('circuit-art', `circuit-mode-${mode}`);
    svg.dataset.traceVersion = TRACE_VERSION;

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

      if (route.branch) {
        makeVisibleSegments(route.branch, geometry.protectedZones, mode).forEach((segment) => {
          baseGroup.append(pathEl(segment, 'circuit-trace branch'));
        });
      }

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

  function renderDebugOverlay(svg, geometry, plan) {
    const debugGroup = svgEl('g', { class: 'circuit-debug-layer' });
    geometry.protectedZones.forEach((zone) => debugGroup.append(rectEl(zone, 'debug-zone')));
    debugGroup.append(circleEl(geometry.sourceHalo.x, geometry.sourceHalo.y, geometry.sourceHalo.radius, 'debug-source-halo'));
    plan.endpoints.forEach((point) => debugGroup.append(circleEl(point.x, point.y, 4, 'debug-terminal')));
    svg.append(debugGroup);
  }

  function mountCircuitDebugPanel(plan, geometry, mode) {
    document.getElementById('circuit-debug-panel')?.remove();
    const panel = document.createElement('div');
    panel.id = 'circuit-debug-panel';
    panel.textContent = [
      TRACE_VERSION,
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
      this.resizeTimer = null;
      this.viewportWidth = 0;
      this.viewportHeight = 0;
    }

    init() {
      const host = document.querySelector(SELECTORS.host);
      if (!host) return;
      if (this.initialized) {
        if (!this.host?.firstChild) this.mount();
        return;
      }

      this.host = host;
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
