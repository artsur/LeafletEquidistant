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
    updateThrottleMs: 20,
    rangeSet: [
      {minZoom: 3, maxZoom: 3, distance: 1000},
      {minZoom: 4, maxZoom: 4, distance: 500},
      {minZoom: 5, maxZoom: 5, distance: 300},
      {minZoom: 6, maxZoom: 6, distance: 100},
      {minZoom: 7, maxZoom: 7, distance: 50},
      {minZoom: 8, maxZoom: 8, distance: 30},
      {minZoom: 9, maxZoom: 9, distance: 20},
      {minZoom: 10, maxZoom: 10, distance: 10},
      {minZoom: 11, maxZoom: 11, distance: 5},
      {minZoom: 12, maxZoom: 12, distance: 3},
      {minZoom: 13, maxZoom: 13, distance: 2},
      {minZoom: 14, maxZoom: 14, distance: 1},
      {minZoom: 15, maxZoom: 15, distance: 0.5},
      {minZoom: 16, maxZoom: 16, distance: 0.2},
      {minZoom: 17, maxZoom: 17, distance: 0.1},
      {minZoom: 18, maxZoom: 18, distance: 0.05},
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
    this._overlay.style.pointerEvents = 'none';
    this._overlay.style.top = '0';
    this._overlay.style.left = '0';
    this._overlay.style.width = 'auto';
    this._overlay.style.height = 'auto';
    this._overlay.style.zIndex = '499';

    const svgGrid = this._createSvgEl('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${mapSize.x} ${mapSize.y}`,
      style: `width: ${mapSize.x}; height: ${mapSize.y}; pointer-events: none;`
    });
    this._overlay.appendChild(svgGrid);
    L.extend(this._overlay, {
      onselectstart: L.Util.falseFn,
      onmousemove: L.Util.falseFn,
      onload: L.bind(this._onGridLoad, this),
    });
    this._map.on('move', this._update, this);

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

    const canvas = L.DomUtil.create('canvas', 'overlay-equidistant-canvas', this._overlay);
    canvas.width = mapSize.x;
    canvas.height = mapSize.y;
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.pointerEvents = 'none';

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = this.options.distanceLinesColor;
    ctx.lineWidth = this.options.distanceLinesWidth;
    ctx.globalAlpha = this.options.distanceLinesOpacity;
    ctx.setLineDash(this.options.distanceLinesDashArray);


    const stepDistance = curentRange.distance * this._distanceFactor[this.options.distanceUnits];
    let distance = 0;

    while (distance <= this._maxVisibleDistance) {
      distance+= stepDistance;
      const r = center.toBounds(distance * 2);
      const rN = this._map.latLngToContainerPoint({lat: r._northEast.lat, lng: center.lng});
      const rW = this._map.latLngToContainerPoint({lat: center.lat, lng: r._southWest.lng});
      const rS = this._map.latLngToContainerPoint({lat: r._southWest.lat, lng: center.lng});

      let i=0;
      let lastPoint = {};
      ctx.beginPath();
      while( i<=360) {
        const point = this._distPoints(center, i, distance);
        i+=6;
        if (!point || point.x <= 1 || point.y <= 1 || point.x >= mapSize.x-1 || point.y >= mapSize.y-1) {
          ctx.stroke();
          ctx.beginPath();
          lastPoint = {};
          continue;
        }
        if (!lastPoint.hasOwnProperty('x')) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
        lastPoint = {...point};
      }
      ctx.stroke();

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

  _distPoints: function(latlng, heading, distance) {
    heading = (heading + 360) % 360;
    let rad = Math.PI / 180,
      radInv = 180 / Math.PI,
      R = 6378137, // approximation of Earth's radius
      lon1 = latlng.lng * rad,
      lat1 = latlng.lat * rad,
      rheading = heading * rad,
      sinLat1 = Math.sin(lat1),
      cosLat1 = Math.cos(lat1),
      cosDistR = Math.cos(distance / R),
      sinDistR = Math.sin(distance / R),
      lat2 = Math.asin(sinLat1 * cosDistR + cosLat1 *
        sinDistR * Math.cos(rheading)),
      lon2 = lon1 + Math.atan2(Math.sin(rheading) * sinDistR *
        cosLat1, cosDistR - sinLat1 * Math.sin(lat2));
    lon2 = lon2 * radInv;
    //lon2 = lon2 > 180 ? lon2 - 360 : lon2 < -180 ? lon2 + 360 : lon2;
    return this._map.latLngToContainerPoint([lat2 * radInv, lon2]);
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

