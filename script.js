var MB = {};

MB.maps = {};

MB.api = function(l) {
    return 'http://api.tiles.mapbox.com/v3/' + l.id + '.jsonp';
};

MB.map = function(el, l) {
    wax.tilejson(MB.api(l), function(t) {
        var h = [
            new MM.DragHandler(),
            new MM.DoubleClickHandler(),
            new MM.TouchHandler()
        ];
        if ($.inArray('zoomwheel',l.features) >= 0) h.push(new MM.MouseWheelHandler());

        MB.maps[el] = new MM.Map(el, new wax.mm.connector(t), null, h);
        MB.maps[el].setCenterZoom({
            lat: (l.center) ? l.center.lat : t.center[1],
            lon: (l.center) ? l.center.lon : t.center[0]
        }, (l.center) ? l.center.zoom : t.center[2]
        );

        if (l.zoomRange) {
            MB.maps[el].setZoomRange(l.zoomRange[0], l.zoomRange[1]);
        } else {
            MB.maps[el].setZoomRange(t.minzoom, t.maxzoom);
        }

        wax.mm.attribution(MB.maps[el], t).appendTo(MB.maps[el].parent);

        if ($.inArray('zoompan',l.features) >= 0) {
            wax.mm.zoomer(MB.maps[el]).appendTo(MB.maps[el].parent);
        }

        if ($.inArray('zoombox',l.features) >= 0) {
            wax.mm.zoombox(MB.maps[el]);
        }

        if ($.inArray('legend',l.features) >= 0) {
            MB.maps[el].legend = wax.mm.legend(MB.maps[el], t).appendTo(MB.maps[el].parent);
        }

        if ($.inArray('bwdetect',l.features) >= 0) {
            wax.mm.bwdetect(MB.maps[el]);
        }

        if ($.inArray('tooltips',l.features) >= 0) {
            MB.maps[el].interaction = wax.mm.interaction()
                .map(MB.maps[el])
                .tilejson(t)
                .on(wax.tooltip()
                    .parent(MB.maps[el].parent)
                    .events()
                );
        } else if ($.inArray('movetips',l.features) >= 0) {
            MB.maps[el].interaction = wax.mm.interaction()
                .map(MB.maps[el])
                .tilejson(t)
                .on(wax.movetip()
                    .parent(MB.maps[el].parent)
                    .events()
                );
        }

        if ($.inArray('share',l.features) >= 0) {
            wax.mm.share(MB.maps[el], t).appendTo(MB.maps[el].parent);
        }

    });
};

MB.refresh = function(m, l) {

    if (l.id) {
        wax.tilejson(MB.api(l), function(t) {
            var layer = l.layer || 0;
            try {
                MB.maps[m].setLayerAt(layer, new wax.mm.connector(t));
            } catch (e) {
                MB.maps[m].insertLayerAt(layer, new wax.mm.connector(t));
            }
            if (MB.maps[m].interaction) MB.maps[m].interaction.tilejson(t);
            if (MB.maps[m].legend) {
                MB.maps[m].legend.content(t);
            }
        });
    }

    if (l.center) {
        var lat = l.center.lat || MB.maps[m].getCenter().lat,
            lon = l.center.lon || MB.maps[m].getCenter().lon,
            zoom = l.center.zoom || MB.maps[m].getZoom();

        if (l.center.ease > 0) {
            MB.maps[m].easey = easey().map(MB.maps[m])
                .to(MB.maps[m].locationCoordinate({ lat: lat, lon: lon })
                .zoomTo(zoom)).run(l.center.ease);
        } else {
            MB.maps[m].setCenterZoom({ lat: lat, lon: lon }, zoom);
        }
    }
};

MB.layers = function(switcher, m, layers) {
    $.each(layers, function(i, l) {
        if (l.el) {
            $('#' + l.el)
                .click(function(e) {
                    e.preventDefault();
                    $('#' + switcher + ' .layer').removeClass('active');
                    $(this).addClass('active');
                    MB.refresh(m, l);
                });
        }

        if (switcher) {
            $('#' + switcher).append($('<a href="#">' + l.name + '</a>')
                .attr('id', 'layer-' + i)
                .addClass('layer')
                .click(function(e) {
                    e.preventDefault();
                    $('#' + switcher + ' .layer').removeClass('active');
                    $(this).addClass('active');
                    MB.refresh(m, l);
                })
            );
        }
    });
};

MB.geocoder = function(el, m, opt) {
    var placeholder = 'Search for an address';
    $('#' + el).append(
        $('<form class="geocode">')
            .append($('<input type="text">').attr('placeholder', placeholder))
            .append($('<input type="submit">'))
            .append($('<div id="geocode-error">'))
            .submit(function(e) {
                e.preventDefault();
                geocode($('input[type=text]', this).val());
            })
    );
    var geocode = function(query) {
        query = encodeURIComponent(query);
        $('form.geocode').addClass('loading');
        switch (opt.service) {
            case 'mapquest open':
                reqwest({
                    url: 'http://open.mapquestapi.com/nominatim/v1/search?format=json&json_callback=callback&&limit=1&q=' + query,
                    type: 'jsonp',
                    jsonpCallback: 'callback',
                    success: function (r) {
                        r = r[0];

                        if (MB.maps[m].geocodeLayer) {
                            MB.maps[m].geocodeLayer
                                .removeAllMarkers();
                        }

                        $('form.geocode').removeClass('loading');

                        if (r === undefined) {
                            $('#geocode-error').text('This address cannot be found.').fadeIn('fast');
                        } else {
                            $('#geocode-error').hide();
                            MB.maps[m].setExtent([
                                { lat: r.boundingbox[1], lon: r.boundingbox[2] },
                                { lat: r.boundingbox[0], lon: r.boundingbox[3] }
                            ]);

                            if (MB.maps[m].getZoom() === MB.maps[m].coordLimits[1].zoom) {
                                var point = { 'type': 'FeatureCollection',
                                    'features': [{ 'type': 'Feature',
                                    'geometry': { 'type': 'Point','coordinates': [r.lon, r.lat] },
                                    'properties': {}
                                }]};

                                if (MB.maps[m].geocodeLayer) {
                                    MB.maps[m].geocodeLayer.removeAllMarkers();
                                    MB.maps[m].geocodeLayer.geojson(point);
                                } else {
                                    MB.maps[m].geocodeLayer = mmg()
                                        .geojson(point);
                                    MB.maps[m].addLayer(MB.maps[m].geocodeLayer);
                                }

                                MB.maps[m].setCenter({ lat: r.lat, lon: r.lon });
                            }
                        }
                    }
                });
            break;
        }
        if ($('.wax-attribution').html().indexOf(opt.attribution) < 0) {
            $('.wax-attribution').append(' - ' + opt.attribution);
        }
    };
};

