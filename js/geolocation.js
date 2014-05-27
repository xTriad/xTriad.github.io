var UserTracking = (function($) {

    // Reference to the google maps API
    var google = null;

    // Reference to the Google map
    var map = null;

    // Coordinates of the user's trip
    var travelCoordinates = [];

    // How often to query the GPS for updated coordinates in milliseconds
    var geoIntervalMS = 5000;
    var geoIntervalRef = null;

    // True if the browser supports the geolocation service
    var hasGeoSupport = !!navigator.geolocation;
    
    // How many times we should check to see if the maps api has loaded
    var loadingCounter = 10;

    // Geolocation settings
    var previousLat = null;
    var previousLong = null;

    /**
     * Initialize Google maps.
     * @return {void}
     */
    function mapInit() {
        // If the Google maps file hasn't finished loading
        if(google == null) {
            if(--loadingCounter <= 0) {
                setTimeout(function() { mapInit(); }, 16);
            } else {
                $('#geo-output').html('Unable to load Google maps');
            }
            return;
        }

        map = new google.maps.Map($('#map-canvas')[0], {
            zoom: 13,
            center: new google.maps.LatLng(-34.397, 150.644)
        });

        var viewPortHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || $(document).height());
        $('#map-canvas').css('height', (viewPortHeight / 1.21) + "px");

        drawPath();
    }

    /**
     * Loads the Google maps Javascript files into the browser.
     * @return {void}
     */
    function loadGoogleMaps() {
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://maps.googleapis.com/maps/api/js?v=3.exp&sensor=true&callback=UserTracking.googleMapsCallback';
        script.onload = function() {
            google = window.google;
        }
        document.body.appendChild(script);
    }

    /**
     * Draws the user's traveled path on the map.
     * @return {void}
     */
    function drawPath() {
        // travelCoordinates = [
        //     new google.maps.LatLng(37.772323, -122.214897),
        //     new google.maps.LatLng(21.291982, -157.821856),
        //     new google.maps.LatLng(-18.142599, 178.431),
        //     new google.maps.LatLng(-27.46758, 153.027892)
        // ];

        if(travelCoordinates.length >= 1) {
            var infoWindowStart = new google.maps.InfoWindow({
                map: map,
                position: travelCoordinates[0],
                content: 'Start Location'
            });

            var travelPath = new google.maps.Polyline({
                path: travelCoordinates,
                geodesic: true,
                strokeColor: '#FF0000',
                strokeOpacity: 1.0,
                strokeWeight: 2
            });

            travelPath.setMap(map);
        } else {
            var randomCoords = new google.maps.LatLng(-34.397, 150.644);
            var infoWindowError = new google.maps.InfoWindow({
                map: map,
                position: randomCoords,
                content: 'There are no travel coordinates to display.'
            });
        }
    }

    /**
     * Handles the case when the browser doesn't have access to the Geolocation service.
     * @param  {boolean} errorFlag False if the browser doesn't support the
     *     Geolocation service.
     * @return {void}
     */
    function handleNoGeolocation(errorFlag) {
        if (errorFlag) {
            // TODO: This needs to be a BIG error to let the user know that the app isn't
            // being allowed to access the GPS. Also need to have this show immediately after
            // they click the start button.
            var content = 'Error: The Geolocation service failed.';
        } else {
            var content = 'Error: Your browser doesn\'t support geolocation.';
        }

        $("#geo-output").html(content);
    }

    /**
     * Gets the user's current GPS coordinates and stores them.
     * @return {void}
     */
    function geoLogCoords() {
        navigator.geolocation.getCurrentPosition(function(position) {
            if(previousLat == null || previousLat != position.coords.latitude || previousLong != position.coords.longitude) {
                previousLat = position.coords.latitude;
                previousLong = position.coords.longitude;

                // TODO: Push the coordinates to disk so we don't use too much memory
                // if(travelCoordinates.length >= 75) {
                //     var storedData = localStorage.getItem("hp-mobile-fleet");
                //     if(storedData != null) {
                //         JSON.parse(storedData).concat(travelCoordinates);
                //         travelCoordinates.clear();
                //     }
                //     localStorage.setItem("hp-mobile-fleet", JSON.stringify(travelCoordinates));
                // }

                var timestamp = Math.round(new Date().getTime() / 1000);
                var textarea = $("#geo-output");
                textarea.html("Latitude=" + position.coords.latitude + ", "
                    + "Longitude=" + position.coords.longitude + "<br>" + textarea.html());

                console.log("Latitude=" + position.coords.latitude + "\n"
                    + "Longitude=" + position.coords.longitude + "\n"
                    + "Accuracy=" + Math.round(position.coords.accuracy, 1) + "m\n"
                    + "Speed=" + position.coords.speed + "m/s\n"
                    + "Altitude=" + position.coords.altitude + "\n"
                    + "Altitude Accuracy=" + Math.round(position.coords.altitudeAccuracy,1) + "\n"
                    + "Heading=" + position.coords.heading + "\n"
                    + "Timestamp=" + timestamp + "\n"
                );

                travelCoordinates.push({lat: position.coords.latitude, lng: position.coords.longitude});
            }
        }, function(error) {
            handleNoGeolocation(true);
            console.log(error);
        });
    }

    /**
     * Calculates the distance between two latitude and logitude points using the
     * Haversine formula. Note that the Haversine formula doesn't account for the
     * Earth being a spheroid, so you'll get some error introduced to where it
     * can't be guaranteed correct to better than 0.5%. 
     * 
     * http://stackoverflow.com/a/27943
     * 
     * @param  {int} lat1 First latitude point
     * @param  {int} lon1 First longitude point
     * @param  {int} lat2 Second latitude point
     * @param  {int} lon2 Second longitude point
     * @return {int} The distance between the two points in kilometers
     */
    function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
        var R = 6371; // Radius of the earth in km
        var dLat = deg2rad(lat2-lat1);  // deg2rad below
        var dLon = deg2rad(lon2-lon1); 
        var a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        var d = R * c; // Distance in km
        return d;
    }

    function deg2rad(deg) {
        return deg * (Math.PI/180);
    }

    /**
     * Starts the gelocation service.
     * @return {void}
     */
    function geoStart() {
        geoLogCoords();
        geoIntervalRef = setInterval(geoLogCoords, geoIntervalMS);
        console.log("Geolocation service started.");
    }

    /**
     * Stops the geolocation service.
     * @return {void}
     */
    function geoStop() {
        clearInterval(geoIntervalRef);
        console.log("Geolocation service stopped.");
    }

    return {
        init: function() {
            if(!hasGeoSupport) {
                handleNoGeolocation(false);
                return;
            }

            // Redraw the Google map when we navigate to the page
            $(document).on("pagebeforecreate", "#googleMapsPage", function() {
                if(!window.google) {
                    loadGoogleMaps();
                } else {
                    drawPath();
                }
            }).on("pageshow", "#googleMapsPage", function() {
                google.maps.event.trigger(map, 'resize');
                if(travelCoordinates.length >= 1)
                    map.setCenter(travelCoordinates[0]);
            });

            return this;
        },
        start: function() {
            if(hasGeoSupport) {
                geoStart();
                $('#startBtn').addClass('ui-state-disabled');
                $('#stopBtn').removeClass('ui-state-disabled');
                $('#viewMapBtn').addClass('ui-state-disabled');
                $('#geo-output').html('');
            }
        },
        stop: function() {
            if(hasGeoSupport) {
                geoStop();

                // TODO: Send results to server

                $('#startBtn').removeClass('ui-state-disabled');
                $('#stopBtn').addClass('ui-state-disabled');
                $('#viewMapBtn').removeClass('ui-state-disabled');

                if(travelCoordinates.length >= 1) {
                    var l = travelCoordinates.length-1;
                    var distance = getDistanceFromLatLonInKm(
                        travelCoordinates[0].lat, travelCoordinates[0].lng,
                        travelCoordinates[l].lat, travelCoordinates[l].lng
                    );
                    $('#geo-output').html('Distance: ' + distance + " kilometers");
                } else {
                    $('#viewMapBtn').addClass('ui-state-disabled');
                    $('#geo-output').html('The app was unable to collect GPS position coordinates.');
                }
            }
        },
        googleMapsCallback: function() {
            mapInit();
        }
    };
})(jQuery).init();

// This is the fastest way to empty an array
// http://jsperf.com/array-clear-methods/3
Array.prototype.clear = function() {
    while(this.length > 0) {
        this.pop();
    }
};