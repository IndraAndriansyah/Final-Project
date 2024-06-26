/*set Routing dari A ke B*/
function RoutingAB(){
  this.state = {
    start: undefined,
    finish: undefined,
    marker: {
      start: undefined,
      finish: undefined
    }
  };
  this.startSearchbox = this.createSearchBox('start');
  this.createSearchBox('finish');

  this.closeButton = document.querySelector('.tt-search-box-close-icon');
  this.startSearchboxInput = this.startSearchbox.getSearchBoxHTML().querySelector('.tt-search-box-input');

  this.startSearchboxInput.addEventListener('input', this.handleSearchboxInputChange.bind(this));

  this.createMyLocationButton();
  this.switchToMyLocationButton();

  this.errorHint = new InfoHint('error', 'bottom-center', 5000).addTo(document.getElementById('map'));

}
/*set current location button*/
RoutingAB.prototype.createMyLocationButton = function() {
  this.upperSearchboxIcon = document.createElement('div');
  this.upperSearchboxIcon.setAttribute('class', 'my-location-button');

  this.upperSearchboxIcon.addEventListener('click', function() {
    navigator.geolocation.getCurrentPosition(
      this.reverseGeocodeCurrentPosition.bind(this),
      this.handleError.bind(this)
    );
  }.bind(this));
};

/*set start search table dihandle function nya */
RoutingAB.prototype.handleSearchboxInputChange = function(event) {
var inputContent = event.target.value;

if (inputContent.length > 0) {
  this.setCloseButton();
} else {
    var resultList = this.startSearchbox.getSearchBoxHTML().querySelector('.tt-search-box-result-list');
      if (resultList || inputContent.length === 0) {
        return;
      }
      this.onResultCleared('start');
  }
};
/*set current position menadi start geocode*/
RoutingAB.prototype.reverseGeocodeCurrentPosition = function(position) {
  this.state.start = [position.coords.longitude, position.coords.latitude];
  tt.services.reverseGeocode({
    key: apiKey,
    position: this.state.start
  })
    .then(this.handleRevGeoResponse.bind(this))
    .catch(this.handleError.bind(this));
};
/*handle geo response dari current posisi awal menjadi address*/
RoutingAB.prototype.handleRevGeoResponse = function(response) {
  var place = response.addresses[0];
  this.state.start = [place.position.lng, place.position.lat];
  this.startSearchbox.setValue(place.address.freeformAddress);
  this.onResultSelected(place, 'start');
};
/*melakukan perhitungan rute (nanti cari cara buat masukin astar atau fuzzy*/
RoutingAB.prototype.calculateRoute = function() {
  if (map.getLayer('route')) {
      map.removeLayer('route');
      map.removeSource('route');
  }
  if (!this.state.start || !this.state.finish) {
    return;
  }
  this.errorHint.hide();
  var startPos = this.state.start.join(',');
  var finalPos = this.state.finish.join(',');

  tt.services.calculateRoute({
    key: apiKey,
    traffic:true,
    travelMode: travelMode,
    computeBestOrder: true,
    computeTravelTimeFor: 'all',
    vehicleWidth:3,
    vehicleLength:8,
    vehicleHeight:3,
     /*karena travelMode nya truck harusnya udh avoid jalan yang motorways*/
    routeType: 'fastest',
    locations: startPos + ':' + finalPos
  })
  .then(function(response) {
    var geojson = response.toGeoJson();
    map.addLayer({
      'id': 'route',
      'type': 'line',
      'source': {
        'type': 'geojson',
        'data': geojson
      },
      'paint': {
        'line-color': '#2faaff',
        'line-width': 8
      }
    }, this.findFirstBuildingLayerId());

    var coordinates = geojson.features[0].geometry.coordinates;
    this.updateRoutesBounds(coordinates);
  }.bind(this))
  .catch(this.handleError.bind(this));
};
/*handeling jika rute eror*/
RoutingAB.prototype.handleError = function(error) {
  this.errorHint.setErrorMessage(error);
};
/*set draw line marker untuk rute*/
RoutingAB.prototype.drawMarker = function(type, viewport) {
  if (this.state.marker[type]) {
      this.state.marker[type].remove();
  }

  var marker = document.createElement('div');
  var innerElement = document.createElement('div');

  marker.className = 'route-marker';
  innerElement.className = 'icon tt-icon -white -' + type;
  marker.appendChild(innerElement);

  this.state.marker[type] = new tt.Marker({ element: marker })
    .setLngLat(this.state[type])
    .addTo(map);

  this.updateBounds(viewport);
};
/*set simbol star n end dengan lokasi LnGLat start n end point */
RoutingAB.prototype.updateBounds = function(viewport) {
  bounds = new tt.LngLatBounds();

  if (this.state.start) {
    bounds.extend(tt.LngLat.convert(this.state.start));
  }
  if (this.state.finish) {
    bounds.extend(tt.LngLat.convert(this.state.finish));
  }
  if (viewport) {
    bounds.extend(tt.LngLat.convert(viewport.topLeftPoint));
    bounds.extend(tt.LngLat.convert(viewport.btmRightPoint));
  }
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { duration: 0, padding: 50 });
  }
};
/*set bounds? untuk set marker di LngLat yang dilewati??*/
RoutingAB.prototype.updateRoutesBounds = function(coordinates) {
  bounds = new tt.LngLatBounds();
  coordinates.forEach(function(point) {
    bounds.extend(tt.LngLat.convert(point));
  });
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { duration: 0, padding: 50 });
  }
};
/*create searcbox untuk set route*/
RoutingAB.prototype.createSearchBox = function(type) {
  var searchBox = new tt.plugins.SearchBox(tt.services, {
    showSearchButton: false,
    searchOptions: {
      key: apiKey
    },
    labels: {
      placeholder: 'Query e.g. Bojongsoang'
    }
  });
  document.getElementById(type + 'SearchBox').appendChild(searchBox.getSearchBoxHTML());
  
  searchBox.on('tomtom.searchbox.resultsfound', function(event) {
    handleEnterSubmit(event, this.onResultSelected.bind(this), this.errorHint, type);
  }.bind(this));
  
  searchBox.on('tomtom.searchbox.resultselected', function(event) {
    if (event.data && event.data.result) {
      this.onResultSelected(event.data.result, type);
    }
  }.bind(this));
  searchBox.on('tomtom.searchbox.resultscleared', this.onResultCleared.bind(this, type));
  return searchBox;
};
/*set show hasil search address yang di pilih*/
RoutingAB.prototype.onResultSelected = function(result, type) {
  var pos = result.position;
  this.state[type] = [pos.lng, pos.lat];

  if (type === 'start') {
    this.setCloseButton();
  }

  this.drawMarker(type, result.viewport);
  this.calculateRoute();
};
/*menghapus hasil searching*/
RoutingAB.prototype.onResultCleared = function(type) {
  this.state[type] = undefined;

  if (this.state.marker[type]) {
    this.state.marker[type].remove();
    this.updateBounds();
  }
  if (type === 'start') {
    this.switchToMyLocationButton();
  }
  this.calculateRoute();
};
/*set close button pada searching lalu di hilangkan ketika searching undefined*/
RoutingAB.prototype.setCloseButton = function() {
  var inputContainer = document.querySelector('.tt-search-box-input-container');
  this.closeButton.classList.remove('-hidden');

  if (document.querySelector('.my-location-button')) {
    inputContainer.replaceChild(this.closeButton, this.upperSearchboxIcon);
  }
};
/*show button current location*/
RoutingAB.prototype.switchToMyLocationButton = function() {
  var inputContainer = document.querySelector('.tt-search-box-input-container');
  inputContainer.replaceChild(this.upperSearchboxIcon, this.closeButton);
};
/*layer route??*/
RoutingAB.prototype.findFirstBuildingLayerId = function() {
  var layers = map.getStyle().layers;
  for (var index in layers) {
    if (layers[index].type === 'fill-extrusion') {
      return layers[index].id;
    }
  }
  throw new Error('Map style does not contain any layer with fill-extrusion type.');
};
new RoutingAB();