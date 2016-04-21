import {MetricsPanelCtrl} from 'app/plugins/sdk';
import _ from 'lodash';
import L from './leaflet';
import TimeSeries from 'app/core/time_series2';
import kbn from 'app/core/utils/kbn';
import mapRenderer from './map_renderer';

const panelDefaults = {
  mapCenterLatitude: 0,
  mapCenterLongitude: 0,
  initialZoom: 1,
  valueName: 'avg',
  circleSize: 100,
  tileServers: {
    'OpenStreetMap': {url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>', subdomains: 'abc'},
    'Mapquest': {url: 'http://otile{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.png', attribution: 'Tiles by <a href="http://www.mapquest.com/">MapQuest</a> &mdash; ' +
              'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
              subdomains: '1234'},
    'CartoDB Dark': {url: 'http://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, &copy;<a href="http://cartodb.com/attributions#basemaps">CartoDB</a>, CartoDB <a href="http://cartodb.com/attributions" target="_blank">attribution</a>', subdomains: '1234'}
  },
  tileServer: 'Mapquest',
  locationData: 'countries'
};

export class WorldmapCtrl extends MetricsPanelCtrl {
  constructor($scope, $injector) {
    super($scope, $injector);
    _.defaults(this.panel, panelDefaults);

    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('panel-teardown', this.onPanelTeardown.bind(this));

    if (!this.map) {
      window.$.getJSON('public/plugins/grafana-worldmap-panel/' + this.panel.locationData + '.json').then(res => {
        this.locations = res;
        this.render();
      });
    }
  }

  onPanelTeardown() {
    if (this.map) this.map.remove();
  }

  onInitEditMode() {
    this.addEditorTab('Worldmap', 'public/plugins/grafana-worldmap-panel/editor.html', 2);
  }

  onDataReceived(dataList) {
    this.series = dataList.map(this.seriesHandler.bind(this));
    const data = [];
    this.setValues(data);
    this.data = data;

    this.render();
  }

  setValues(data) {
    if (this.series && this.series.length > 0) {
      this.series.forEach(serie => {
        const lastPoint = _.last(serie.datapoints);
        const lastValue = _.isArray(lastPoint) ? lastPoint[0] : null;

        if (_.isString(lastValue)) {
          data.push({key: serie.alias, value: 0, valueFormatted: lastValue, valueRounded: 0});
        } else {
          const dataValue = {
            key: serie.alias,
            value: serie.stats[this.panel.valueName],
            flotpairs: serie.flotpairs,
            valueFormatted: lastValue,
            valueRounded: 0
          };

          dataValue.valueRounded = kbn.roundValue(dataValue.value, 0);
          data.push(dataValue);
        }
      });
    }
  }

  seriesHandler(seriesData) {
    const series = new TimeSeries({
      datapoints: seriesData.datapoints,
      alias: seriesData.target,
    });

    series.flotpairs = series.getFlotPairs(this.panel.nullPointMode);
    return series;
  }

  setNewMapCenter() {
    this.mapCenterMoved = true;
    this.panToMapCenter();
  }

  panToMapCenter() {
    this.map.panTo([this.panel.mapCenterLatitude, this.panel.mapCenterLongitude]);
  }

  setZoom() {
    this.map.setZoom(this.panel.initialZoom);
  }

  changeTileServer() {
    this.map.remove();
    this.map = null;
    this.render();
  }

  changeLocationData() {
    window.$.getJSON('public/plugins/grafana-worldmap-panel/' + this.panel.locationData + '.json').then(res => {
      this.locations = res;
      this.render();
    });
  }

  link(scope, elem, attrs, ctrl) {
    mapRenderer(scope, elem, attrs, ctrl);
  }
}

WorldmapCtrl.templateUrl = 'module.html';