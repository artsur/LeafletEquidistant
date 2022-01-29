//import L from 'leaflet';
( function () {
L.LeafletEquidistant = L.Control.extend({
  includes: (L.Evented.prototype || L.Mixin.Events),
  options: {
    centerDot: true,
    centerLines: true,
    labels: true,
    distanceUnits: 'km', //km mi nm m
    centerDotColor: '#d00',
    centerDotSize: 4,
    centerDotOpacity: 0.3,
    centerLinesColor: '#d00',
    centerLinesDashArray: [8, 4],
    centerLinesWidth: 0.7,
    centerLinesOpacity: 0.7,
    distanceLinesColor: '#d00',
    distanceLinesDashArray: [2, 3],
    distanceLinesWidth: 0.6,
    distanceLinesOpacity: 0.6,
    labelsColor: '#f00',
    labelsFont: '10px sans-serif',
    labelUnits: 'km',
    updateThrottleMs: 10,
    rangeSet: [
      {minZoom: 1, maxZoom: 2, distance: 5000},
      {minZoom: 3, maxZoom: 3, distance: 1000},
      {minZoom: 4, maxZoom: 4, distance: 500},
      {minZoom: 5, maxZoom: 5, distance: 300},
      {minZoom: 6, maxZoom: 6, distance: 100},
      {minZoom: 7, maxZoom: 7, distance: 50},
      {minZoom: 8, maxZoom: 8, distance: 30},
      {minZoom: 9, maxZoom: 9, distance: 10},
      {minZoom: 10, maxZoom: 10, distance: 5},
      {minZoom: 11, maxZoom: 11, distance: 3},
      {minZoom: 12, maxZoom: 12, distance: 2},
      {minZoom: 13, maxZoom: 13, distance: 1},
      {minZoom: 14, maxZoom: 14, distance: 0.5},
      {minZoom: 15, maxZoom: 15, distance: 0.2},
      {minZoom: 16, maxZoom: 16, distance: 0.1},
      {minZoom: 17, maxZoom: 17, distance: 0.05},
      {minZoom: 18, maxZoom: 18, distance: 0.02},
      {minZoom: 19, maxZoom: 22, distance: 0.01},
    ]
  },

  initialize: function(options) {
    L.setOptions(this, options);
    this._distanceFactor = {
      km: 1000,
      mi: 1650,
      nm: 1982,
      m: 1
    };
  },

  onAdd: function(map) {
    console.log('onAdd');
    this._map = map;
  },

  onRemove: function(map) {
    console.log('onRemove');
    this._removeSvgGrid();
  },

  addTo: function(map) {
    this._map = map;
    this._addSvgGrid();
  },

  _addSvgGrid: function() {

    const mapSize = this._map.getSize(); //mapSize in pixels
    const xCenter = Math.round(mapSize.x / 2); //x-coordinate of map center in pixels
    const yCenter = Math.round(mapSize.y / 2); //y-coordinate of map center in pixels
    const bounds = this._map.getBounds(); //geographical coordinates of map corners
    const center = this._map.getCenter(); //geographical coordinates of map center
    const zoom = this._map.getZoom(); //current map zoom
    const curentRange = this.options.rangeSet.find((range) => (zoom >= range.minZoom && zoom <= range.maxZoom));

    this._maxVisibleDistance = Math.max( this._map.distance(center, bounds._northEast) , this._map.distance(center, bounds._southWest));
    this._minVisibleDistance = Math.min(
      this._map.distance(center, {lat: center.lat, lng: bounds._northEast.lng}),
      this._map.distance(center, {lng: center.lng, lat: bounds._northEast.lat}),
      this._map.distance(center, {lng: center.lng, lat: bounds._southWest.lat}),
    );

    this._overlay = L.DomUtil.create('div', 'overlay-grid', this._map?.getContainer() /*this._map.getPane('overlayPane')*/);
    this._overlay.style.display = 'block';
    this._overlay.style.position = 'relative';
    this._overlay.style.top = '0';
    this._overlay.style.left = '0';
    this._overlay.style.width = 'auto';
    this._overlay.style.height = 'auto';
    this._overlay.style.zIndex = '499';

    const svgGrid = this._createSvgEl('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${mapSize.x} ${mapSize.y}`,
      style: `width: ${mapSize.x}; height: ${mapSize.y}`
    });
    this._overlay.appendChild(svgGrid);
    L.extend(this._overlay, {
      onselectstart: L.Util.falseFn,
      onmousemove: L.Util.falseFn,
      onload: L.bind(this._onGridLoad, this),
    });
    this._map.on('move', this._update, this);

    /** Masks for cut off ellipses */
    const defs = this._createSvgEl('defs');
    const topClipPath = this._createSvgEl('clipPath', {id: 'north-distances-mask'});
    topClipPath.appendChild(this._createSvgEl('rect', {x: 0, y: 0, width: mapSize.x, height: yCenter }));
    defs.appendChild(topClipPath);
    const bottomClipPath = this._createSvgEl('clipPath', {id: 'south-distances-mask'});
    bottomClipPath.appendChild(this._createSvgEl('rect', {x: 0, y: yCenter, width: mapSize.x, height: mapSize.y}));
    defs.appendChild(bottomClipPath);
    svgGrid.appendChild(defs);


    /** Center Lines */
    if (this.options.centerLines) {
      const centerLinesGroup = this._createSvgEl('g', {
        fill: 'none',
        stroke: this.options.centerLinesColor,
        'stroke-dasharray': this.options.centerLinesDashArray,
        'stroke-opacity': this.options.centerLinesOpacity,
        'stroke-width': this.options.centerLinesWidth
      });
      centerLinesGroup.appendChild(this._createSvgEl('line',{x1: xCenter, y1: yCenter, x2: xCenter, y2: 0}));
      centerLinesGroup.appendChild(this._createSvgEl('line',{x1: xCenter, y1: yCenter, x2: xCenter, y2: mapSize.y}));
      centerLinesGroup.appendChild(this._createSvgEl('line',{x1: xCenter, y1: yCenter, x2: 0, y2: yCenter}));
      centerLinesGroup.appendChild(this._createSvgEl('line',{x1: xCenter, y1: yCenter, x2: mapSize.x, y2: yCenter}));
      svgGrid.appendChild(centerLinesGroup);
    }

    /** Center Dot */
    if (this.options.centerDot) {
      svgGrid.appendChild(this._createSvgEl('circle', {
        r: this.options.centerDotSize,
        cx: xCenter,
        cy: yCenter,
        fill: this.options.centerDotColor,
        opacity: this.options.centerDotOpacity,
      }));
    }

    if (!curentRange) return;

    const northEllipseGroup = this._createSvgEl('g', {
      fill: 'none',
      stroke: this.options.distanceLinesColor,
      'stroke-dasharray': this.options.distanceLinesDashArray,
      'stroke-opacity': this.options.distanceLinesOpacity,
      'stroke-width': this.options.distanceLinesWidth,
      'clip-path': 'url(#north-distances-mask)'
    });
    const southEllipseGroup = this._createSvgEl('g', {
      fill: 'none',
      stroke: this.options.distanceLinesColor,
      'stroke-dasharray': this.options.distanceLinesDashArray,
      'stroke-opacity': this.options.distanceLinesOpacity,
      'stroke-width': this.options.distanceLinesWidth,
      'clip-path': 'url(#south-distances-mask)'
    });
    svgGrid.appendChild(northEllipseGroup);
    svgGrid.appendChild(southEllipseGroup);

    const stepDistance = curentRange.distance * this._distanceFactor[this.options.distanceUnits];
    let distance = 0;

    while (distance <= this._maxVisibleDistance) {
      distance+= stepDistance;
      const r = center.toBounds(distance * 2);
      const rN = this._map.latLngToContainerPoint({lat: r._northEast.lat, lng: center.lng});
      const rW = this._map.latLngToContainerPoint({lat: center.lat, lng: r._southWest.lng});
      const rS = this._map.latLngToContainerPoint({lat: r._southWest.lat, lng: center.lng});
      const mainRadius = xCenter - rW.x;
      const topRadius = yCenter - rN.y;
      const bottomRadius = rS.y - yCenter;

      northEllipseGroup.appendChild(this._createSvgEl('ellipse', {rx: mainRadius, ry: topRadius, cx: xCenter, cy: yCenter}));
      southEllipseGroup.appendChild(this._createSvgEl('ellipse', {rx: mainRadius, ry: bottomRadius, cx: xCenter, cy: yCenter}));


      if (this.options.labels) {
        const textN = this._createSvgEl('text', {
          x: rN.x + 2,
          y: rN.y - 2,
          style: `fill: ${this.options.labelsColor}; font: ${this.options.labelsFont}`
        });
        const textW = this._createSvgEl('text', {
          x: rW.x + 2,
          y: rW.y - 2,
          style: `fill: ${this.options.labelsColor}; font: ${this.options.labelsFont}`
        });
        textN.innerHTML = textW.innerHTML = distance / this._distanceFactor[this.options.distanceUnits] + this.options.labelUnits;
        svgGrid.appendChild(textN);
        svgGrid.appendChild(textW);

        svgGrid.appendChild(this._createSvgEl('circle', {r: 1, cx: rN.x, cy: rN.y, fill: this.options.labelsColor}));
        svgGrid.appendChild(this._createSvgEl('circle', {r: 1, cx: rW.x, cy: rW.y, fill: this.options.labelsColor}));
        svgGrid.appendChild(this._createSvgEl('circle', {r: 1, cx: rS.x, cy: rS.y, fill: this.options.labelsColor}));
        svgGrid.appendChild(this._createSvgEl('circle', {r: 1, cx: xCenter * 2 - rW.x, cy: rW.y, fill: this.options.labelsColor}));
      }
    }

  },

  _removeSvgGrid: function() {
    L.DomUtil.remove(this._overlay);
    this._map.off('move', this._update, this);
  },

  _update: function() {
    if (this._throttleTimer) clearTimeout(this._throttleTimer);
    this._throttleTimer = setTimeout(() => {
      this._removeSvgGrid();
      this._addSvgGrid();
    }, this.options.updateThrottleMs);
  },

  _createSvgEl: function(elName, elAttributes) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", elName);
    if (!elAttributes || !Object.keys(elAttributes).length ) return el;
    Object.keys(elAttributes).forEach((key) => {
      el.setAttribute(key, elAttributes[key]);
    });
    return el;
  },

  _onGridLoad: function () {
    this.fire('load');
  },
});

L.leafletEquidistant = function (options) {
  return new L.LeafletEquidistant(options);
};

}());

