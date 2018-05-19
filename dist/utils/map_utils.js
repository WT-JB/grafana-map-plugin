'use strict';

System.register(['lodash', '../vendor/highcharts/highcharts', '../vendor/highcharts/modules/exporting', 'app/core/config', './string', '../definitions', '../utils/highcharts/custom_themes'], function (_export, _context) {
  "use strict";

  var _, Highcharts, Exporting, config, titleize, AQI, CARS_COUNT, NOMINATIM_ADDRESS, HIGHCHARTS_THEME_DARK, _slicedToArray;

  /*
  * Primary functions
  */

  /**
  * Display popups based in the click in map's marker
  */
  function drawPopups(panelId, lastValueMeasure, validatedMetrics) {

    //render popups
    try {
      // Show Metrics Legend (MAP)

      //draw select
      if (validatedMetrics) {

        hideAllGraphPopups(panelId);

        drawMeasuresPopup(panelId, lastValueMeasure, validatedMetrics);

        switch (lastValueMeasure.type) {
          case 'AirQualityObserved':
            var aqiIndex = calculateAQIIndex(lastValueMeasure.value);

            document.getElementById('environment_table_' + panelId).style.display = 'block';

            drawHealthConcernsPopup(panelId, AQI.risks[aqiIndex], AQI.color[aqiIndex], AQI.meaning[aqiIndex]);

            break;
          case 'TrafficFlowObserved':
            drawTrafficFlowPopup(panelId);
            break;
          default:
            drawDefaultPopups(panelId);
        }
      }
    } catch (error) {
      console.log("Error:");
      console.log(error);
      console.log("lastValueMeasure: ");
      console.log(lastValueMeasure);
    }
  }
  /*
  * Draw the select box in the specific panel, with the specif metrics and select the option
  */
  function drawSelect(panelId, metricsToShow, providedMetrics, currentParameterForChart) {
    // Remove air paramters from dropdown
    var el = document.querySelector('#parameters_dropdown_' + panelId);
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }

    //default option
    var emptyOption = document.createElement('option');
    emptyOption.id = 'metricsOption_' + panelId;
    emptyOption.value = 'value';
    emptyOption.innerHTML = 'Select Metric';
    el.appendChild(emptyOption);

    //select population
    Object.keys(metricsToShow).forEach(function (metric) {
      providedMetrics.forEach(function (elem) {
        if (elem[0] == metric) {
          var newMetric = document.createElement('option');
          newMetric.id = 'metricsOption_' + panelId;
          newMetric.value = metric.toUpperCase();

          if (currentParameterForChart === newMetric.value) newMetric.selected = 'selected';

          newMetric.innerHTML = elem[1] ? elem[1] : titleize(elem[0]);

          el.appendChild(newMetric);
        }
      });
    });

    var selectBox = document.querySelector('#parameters_dropdown_' + panelId);
    if (selectBox.options.length > 0) selectBox.style.display = 'block';
  }
  /**
  * Render's the chart in panel
  */
  function renderChart(panelId, selectedPointData, measurementUnits, chartDetails) {
    console.debug('renderChart');

    var _chartDetails = _slicedToArray(chartDetails, 3),
        type = _chartDetails[0],
        pointId = _chartDetails[1],
        fieldName = _chartDetails[2];

    drawChartCointainer(panelId);

    //prepare data to chart
    var chartData = selectedPointData.map(function (elem) {
      return createLine(elem.created_at, elem[fieldName.toLowerCase()]);
    });

    function getChartMetaInfo() {
      var props = {
        AirQualityObserved: 'Air Quality',
        TrafficFlowObserved: 'Cars'
      };

      return {
        title: (props[type] || type) + ': Device ' + pointId + ' - ' + (measurementUnits[1] ? measurementUnits[1] : titleize(measurementUnits[0])),
        units: measurementUnits[2] ? measurementUnits[1] + ' (' + measurementUnits[2] + ')' : measurementUnits[1]
      };
    }

    var chartInfo = getChartMetaInfo();

    //config highchart acording with grafana theme
    if (!config.bootData.user.lightTheme) {
      Highcharts.theme = HIGHCHARTS_THEME_DARK;

      // Apply the theme
      Highcharts.setOptions(Highcharts.theme);
    }

    Highcharts.chart('graph_container_' + panelId, {
      chart: {
        type: 'line',
        height: 200,
        zoomType: 'x',
        events: {
          load: function load() {
            chartData = this.series[0]; // set up the updating of the chart each second
          }
        }
      },
      title: {
        text: chartInfo.title
      },
      subtitle: {
        text: ''
      },
      xAxis: {
        type: 'datetime'
      },
      yAxis: {
        title: {
          text: chartInfo.units
        }
      },
      legend: {
        enabled: false
      },
      series: [{
        name: chartInfo.units,
        data: chartData
      }]
    });
  }

  /**
  * private functions
  */
  function getDataPointExtraFields(dataPoint) {

    var values = {
      fillOpacity: 0.5
    };

    if (dataPoint.type === 'AirQualityObserved') {
      var aqiIndex = calculateAQIIndex(dataPoint.value);
      var aqiColor = AQI.color[aqiIndex];

      _.defaults(values, {
        color: aqiColor,
        fillColor: aqiColor,

        aqiColor: aqiColor,
        aqiMeaning: AQI.meaning[aqiIndex],
        aqiRisk: AQI.risks[aqiIndex],
        aqi: dataPoint.value,

        markerColor: AQI.markerColor[aqiIndex]
      });
    } else {
      if (dataPoint.type === 'TrafficFlowObserved') {
        var colorIndex = calculateCarsIntensityIndex(dataPoint.value);

        _.defaults(values, {
          color: CARS_COUNT.color[colorIndex],
          fillColor: CARS_COUNT.color[colorIndex],

          markerColor: CARS_COUNT.markerColor[colorIndex]
        });
      }
    }

    return values;
  }

  function getMapMarkerClassName(type, value) {
    var resp = 'map-marker-';
    if (type === 'AirQualityObserved') {
      return resp + AQI.classColor[calculateAQIIndex(value)];
    } else if (type === 'TrafficFlowObserved') return resp + CARS_COUNT.classColor[calculateCarsIntensityIndex(value)];
    return resp + 'default';
  }

  function getDataPointStickyInfo(dataPoint, metricsTranslations) {
    var dataPointExtraFields = getDataPointExtraFields(dataPoint);
    var stickyInfo = '<div class="stycky-popup-info">';

    if (dataPoint.type === 'AirQualityObserved') {
      stickyInfo += '<div class="head air-quality">Air Quality</div>';
    } else {
      if (dataPoint.type === 'TrafficFlowObserved') {
        stickyInfo += '<div class="head traffic-flow">Cars Intensity</div>';
      } else {
        stickyInfo += '<div class="head">' + dataPoint.type + '</div>';
      }
    }

    //body
    stickyInfo += '<div class="body">';
    stickyInfo += getDataPointDetails(dataPoint, metricsTranslations).join('');
    stickyInfo += '</div>';
    stickyInfo += '</div>';

    //console.debug(dataPoint)
    return stickyInfo;
  }

  function getDataPointDetails(dataPoint, metricsTranslations) {
    var translatedValues = Object.keys(dataPoint).map(function (dpKey) {
      var dP = dataPoint[dpKey];
      var trans = metricsTranslations.filter(function (elem) {
        return elem[0] === dpKey;
      });
      return { 'name': trans.length > 0 && trans[0][1] ? trans[0][1] : titleize(dpKey), value: dP || '-', unit: trans.length > 0 ? trans[0][2] : '' };
    });

    return translatedValues.map(function (translatedValue) {
      return '<div>' + translatedValue.name + ': ' + translatedValue.value + ' ' + (translatedValue.unit || '') + '</div>';
    });
  }

  //show all accepted metrics for a specific point id
  function getMetricsToShow(allMetrics, id) {
    var metricsToShow = {};

    var _loop = function _loop(key) {
      allMetrics[key].forEach(function (_value) {
        if (_value.id === id) {
          if (_value.value) {
            if (!metricsToShow[key]) {
              metricsToShow[key] = 0;
            }
            metricsToShow[key] = _value.value;
          }
        }
      });
    };

    for (var key in allMetrics) {
      _loop(key);
    }

    //  metricsToShow['aqi'] = aqi;
    return metricsToShow;
  }

  // Given vars passed as param, retrieves the selected city
  function getSelectedCity(vars) {
    var cityenv_ = vars.filter(function (elem) {
      return elem.name === "cityenv";
    });
    var city = null;
    if (cityenv_ && cityenv_.length === 1) city = cityenv_[0].current.value;

    return city;
  }

  function hideAllGraphPopups(panelId) {
    var map_table_popups = ['measures_table', 'health_concerns_wrapper', 'environment_table', 'traffic_table'];

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = map_table_popups[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var map_table_popup = _step.value;

        var popup = document.getElementById(map_table_popup + '_' + panelId);
        if (popup) popup.style.display = 'none';
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }
  }

  function drawDefaultPopups() {}
  /*
  * Draw Traffic Flow Popup
  */
  function drawTrafficFlowPopup(panelId) {
    document.getElementById('traffic_table_' + panelId).style.display = 'block';
  }
  /*
  * Draw Health Concerns Popup
  */
  function drawHealthConcernsPopup(panelId, risk, color, meaning, map_size) {
    var healthConcernsWrapper = document.getElementById('health_concerns_wrapper_' + panelId);
    var healthConcerns = document.querySelector('#health_concerns_wrapper_' + panelId + '>div');
    var healthConcernsColor = document.querySelector('#health_concerns_wrapper_' + panelId + '>div>span>span.color');
    var healthRisk = document.getElementById('health_risk_' + panelId);

    healthConcernsWrapper.style.display = 'block';
    healthConcernsColor.style.backgroundColor = color;
    healthRisk.innerHTML = risk;
  }
  /*
  * Draw Measures Popup - The popup info is related with the choosed value 
  *  from select box and with the metrics that came from result set
  *  and from a list of what to show metrics
  */
  function drawMeasuresPopup(panelId, metricsToShow, providedMetrics) {
    var measuresTable = document.querySelector('#measures_table_' + panelId + ' > table > tbody');
    while (measuresTable.rows[0]) {
      measuresTable.deleteRow(0);
    }Object.keys(metricsToShow).forEach(function (metric) {
      providedMetrics.forEach(function (elem) {
        if (elem[0] == metric) {
          var row = measuresTable.insertRow(); // -1 for inserting bottom
          var innerCell0 = elem[1] ? elem[1] : titleize(elem[0]);
          var innerCell1 = (metricsToShow[metric] ? metricsToShow[metric] : '-') + (elem[2] ? ' ' + elem[2] : '');
          var cell0 = row.insertCell(0);
          var cell1 = row.insertCell(1);

          cell0.innerHTML = innerCell0;
          cell1.innerHTML = innerCell1;
        }
      });
    });

    document.getElementById('measures_table_' + panelId).style.display = 'block';
  }
  /*
  * Draw Chart
  */
  function drawChartCointainer(panelId) {
    document.querySelector('#data_details_' + panelId).style.display = 'block';
    document.getElementById('data_chart_' + panelId).style.display = 'block';
  }

  // Access remote api and gives the coordinates from a city center based on NOMINATIM url server
  function getCityCoordinates(city_name) {
    var url = NOMINATIM_ADDRESS.replace('<city_name>', city_name);
    return fetch(url).then(function (response) {
      return response.json();
    }).then(function (data) {
      return { latitude: data[0].lat, longitude: data[0].lon };
    }).catch(function (error) {
      return console.error(error);
    });
  }

  // gets the aqi index from the AQI var
  function calculateAQIIndex(value) {
    var aqiIndex = void 0;
    AQI.range.forEach(function (elem, index) {
      if (value >= elem) {
        aqiIndex = index;
      }
    });
    return aqiIndex;
  }
  // gets the index from the CARS_COUNT const var
  function calculateCarsIntensityIndex(value) {
    CARS_COUNT.range.forEach(function (elem, index) {
      if (value >= elem) {
        return index;
      }
    });
    return 0;
  }

  /*
  * Auxiliar functions
  */
  // just for improve DRY
  function createLine(time_, value) {
    var time = new Date(time_);
    var day = time.getDate();
    var month = time.getMonth();
    var year = time.getFullYear();
    var hour = time.getHours() - 1;
    var minutes = time.getMinutes();
    var seconds = time.getSeconds();
    var milliseconds = time.getMilliseconds();
    return [Date.UTC(year, month, day, hour + 1, minutes, seconds, milliseconds), value];
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_vendorHighchartsHighcharts) {
      Highcharts = _vendorHighchartsHighcharts.default;
    }, function (_vendorHighchartsModulesExporting) {
      Exporting = _vendorHighchartsModulesExporting.default;
    }, function (_appCoreConfig) {
      config = _appCoreConfig.default;
    }, function (_string) {
      titleize = _string.titleize;
    }, function (_definitions) {
      AQI = _definitions.AQI;
      CARS_COUNT = _definitions.CARS_COUNT;
      NOMINATIM_ADDRESS = _definitions.NOMINATIM_ADDRESS;
    }, function (_utilsHighchartsCustom_themes) {
      HIGHCHARTS_THEME_DARK = _utilsHighchartsCustom_themes.HIGHCHARTS_THEME_DARK;
    }],
    execute: function () {
      _slicedToArray = function () {
        function sliceIterator(arr, i) {
          var _arr = [];
          var _n = true;
          var _d = false;
          var _e = undefined;

          try {
            for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
              _arr.push(_s.value);

              if (i && _arr.length === i) break;
            }
          } catch (err) {
            _d = true;
            _e = err;
          } finally {
            try {
              if (!_n && _i["return"]) _i["return"]();
            } finally {
              if (_d) throw _e;
            }
          }

          return _arr;
        }

        return function (arr, i) {
          if (Array.isArray(arr)) {
            return arr;
          } else if (Symbol.iterator in Object(arr)) {
            return sliceIterator(arr, i);
          } else {
            throw new TypeError("Invalid attempt to destructure non-iterable instance");
          }
        };
      }();

      // Initialize exporting module.
      Exporting(Highcharts);

      /* Grafana Specific */


      /* App specific */

      _export('hideAllGraphPopups', hideAllGraphPopups);

      _export('drawPopups', drawPopups);

      _export('drawSelect', drawSelect);

      _export('renderChart', renderChart);

      _export('getCityCoordinates', getCityCoordinates);

      _export('getDataPointExtraFields', getDataPointExtraFields);

      _export('getDataPointStickyInfo', getDataPointStickyInfo);

      _export('getSelectedCity', getSelectedCity);

      _export('getMapMarkerClassName', getMapMarkerClassName);
    }
  };
});
//# sourceMappingURL=map_utils.js.map
