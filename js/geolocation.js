var UserTracking = (function($) {

    // Reference to the google maps API
    var google = null;

    // Reference to the Google map
    var map = null;

    // The localStorage key
    var storageKey = "hp-mobile-fleet";

    // Coordinates of the user's trip
    var travelCoordinates = [];

    // How far the user has traveled
    var travelDistance = 0;

    // The user's average speed in m/s
    var averageSpeed = 0;
    var speedReadingCount = 0;

    // How often to query the GPS for updated coordinates in milliseconds
    var geoIntervalMS = 5000;
    var geoIntervalRef = null;

    // The number of coordinates we need in memory before writing to disk
    var writeToDiskCount = 5;

    // Keep track of the last travel coordinate for distance calculations
    var lastTravelCoordinate = null;

    // True if the browser supports the geolocation service
    var hasGeoSupport = !!navigator.geolocation;

    // How many times we should check to see if the maps api has loaded
    var loadingCounter = 10;

    // Geolocation settings
    var previousLat = null;
    var previousLong = null;
    var options = {
        enableHighAccuracy: false,
        timeout: 4096,
        maximumAge: 4096
    };

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
        if(travelCoordinates.length >= 1) {
            var infoWindowStart = new google.maps.InfoWindow({
                map: map,
                position: travelCoordinates[0],
                content: 'Start Location'
            });

            if(travelCoordinates.length > 1) {
                var infoWindowStop = new google.maps.InfoWindow({
                    map: map,
                    position: travelCoordinates[travelCoordinates.length-1],
                    content: 'End Location'
                });
            }

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

        $("#geo-output").html($("#geo-output").html() + "<br>" + content);
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

                // Update the traveling distance
                if(lastTravelCoordinate != null) {
                    travelDistance += getDistanceFromLatLon(
                        lastTravelCoordinate.lat, lastTravelCoordinate.lng,
                        position.coords.latitude, position.coords.longitude
                    );
                }

                // Write to disk if we are using too much memory
                if(travelCoordinates.length >= writeToDiskCount) {
                    storeData(false);
                }

                var timestamp = Math.round(new Date().getTime() / 1000);
                var textarea = $("#geo-output");
                textarea.html("Latitude=" + position.coords.latitude + ", "
                    + "Longitude=" + position.coords.longitude + "<br>" + textarea.html());

                // Keep track of the user's speed
                if(position.coords.speed != null) {
                    speedReadingCount++;
                    averageSpeed += position.coords.speed;
                    textarea.html("Speed=" + position.coords.latitude + "<br><br>" + textarea.html());
                }

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
                lastTravelCoordinate = travelCoordinates[travelCoordinates.length-1];
            }
        }, function(error) {
            handleNoGeolocation(true);
            console.log(error);
        }, options);
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
     * @return {int} The distance between the two points in miles
     */
    function getDistanceFromLatLon(lat1, lon1, lat2, lon2) {
        var R = 6371; // Radius of the earth in km
        var dLat = deg2rad(lat2-lat1);  // deg2rad below
        var dLon = deg2rad(lon2-lon1); 
        var a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        var d = R * c * 0.621371; // Distance in km to miles
        return d;
    }

    function deg2rad(deg) {
        return deg * (Math.PI/180);
    }

    /**
     * Pushes the coordinates to disk so we don't use too much memory. Although localStorage
     * is typically given 5MB of data (5,242,880 characers), UFT16 is used so each character
     * is two bytes which gives us a total of 2,610,954 characters that we can store.
     * @param {bool} _loadAllData True if the "travelCoordinates" array should also be loaded
     *    with all the data that has been accumulated so far
     * @return {void}
     */
    function storeData(_loadAllData) {
        if(travelCoordinates.length > 0) {
            console.log("Storing data in localStorage: " + JSON.stringify(travelCoordinates));

            var storedData = localStorage.getItem(storageKey);

            if(storedData != null) {
                var dataArray = JSON.parse(storedData).concat(travelCoordinates);
                var jsonData = JSON.stringify(dataArray);
                localStorage.setItem(storageKey, jsonData);

                console.log("Storage: " + jsonData);

                if(_loadAllData) {
                    travelCoordinates = null;
                    travelCoordinates = dataArray;
                }

                jsonData = null;
                dataArray = null;
            } else {
                localStorage.setItem(storageKey, JSON.stringify(travelCoordinates));
            }

            if(!_loadAllData)
                travelCoordinates.clear();
        }
    }

    /**
     * Starts the gelocation service.
     * @return {void}
     */
    function geoStart() {
        // TODO: Make sure previous trip has been sent to server
        localStorage.setItem(storageKey, "[]");
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
        storeData(true);
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

                if(lastTravelCoordinate != null) {
                    if(speedReadingCount == 0)
                        speedReadingCount++;
                    $('#geo-output').html(
                        'Distance: ' + travelDistance + ' miles<br>' +
                        'Speed: ' + (averageSpeed / speedReadingCount) + ' m/s'
                    );
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