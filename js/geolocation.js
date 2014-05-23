var UserTracking = (function($, google) {

    // Reference to the Google map
    var map = null;
    var initialPos = null;

    // Geolocation settings
    var wpid = null;
    var previousLat = null;
    var previousLong = null;
    var minAccuracy = 150; // Double representing the accuracy of the latitude and longitude properties expressed in meters
    var enableHighAccuracy = true; // receive the best possible results which can take longer to process
    var maximumAge = 5000; // Maximum age in milliseconds of a possible cached position that is acceptable to return
    var timeout = 2500; // Maximum length of time (in milliseconds) the device is allowed to take in order to return a position
    //var distance_travelled = 0;

    /**
     * Initialize Google maps and the Geotracking service.
     * @return {void}
     */
    function mapInit() {
        map = new google.maps.Map($('#map-canvas')[0], {
            zoom: 15
        });

        if(navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                initialPos = new google.maps.LatLng(
                    position.coords.latitude,
                    position.coords.longitude
                );

                var infoWindow = new google.maps.InfoWindow({
                    map: map,
                    position: initialPos,
                    content: 'Location found using HTML5.'
                  });

                  map.setCenter(initialPos);
                  geoInit();
            }, function() {
                  handleNoGeolocation(true);
            });
        } else {
            // Browser doesn't support Geolocation
            handleNoGeolocation(false);
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
            var content = 'Error: The Geolocation service failed.';
        } else {
            var content = 'Error: Your browser doesn\'t support geolocation.';
        }

        var options = {
            map: map,
            position: new google.maps.LatLng(60, 105),
            content: content
        };

        var infoWindow = new google.maps.InfoWindow(options);
        map.setCenter(options.position);
    }

    /**
     * Adds a leader "0" to the time component that is < 10 to make it cross browser
     * @param  {int} timeComponent The integer value of the time component that orginated
     *     from methods such as getHours(), getMinutes(), getSeconds() etc.
     * @return {string} The modified tiem component.
     */
    function formatTimeComponent(timeComponent) {
        if(timeComponent < 10)
            timeComponent = "0" + timeComponent;
        else if(timeComponent.length < 2)
            timeComponent = timeComponent + "0";
        return timeComponent;
    }

    /**
     * Called each time the user's location is updated by the geolocation service.
     * @param  {Position Object} position The user's geolocation coordinates
     * @return {void}
     */
    function geoSuccess(position) {
        var d = new Date();
        var h = d.getHours();
        var m = d.getMinutes();
        var s = d.getSeconds();

        if(previousLat != null && previousLong != null) {
            var travelCoordinates = [
                new google.maps.LatLng(previousLat, previousLong),
                new google.maps.LatLng(position.coords.latitude, position.coords.longitude),
            ];
            var travelPath = new google.maps.Polyline({
                path: travelCoordinates,
                geodesic: true,
                strokeColor: '#FF0000',
                strokeOpacity: 1.0,
                strokeWeight: 2
            });
            travelPath.setMap(map);
        }

        var currentDatetime = formatTimeComponent(h) + ":" + formatTimeComponent(m) + ":" + formatTimeComponent(s);

        // Check that the accuracy of our Geo location is sufficient for our needs
        if(position.coords.accuracy <= minAccuracy) {
            // We don't want to action anything if our position hasn't changed - we need this because
            // on IPhone Safari at least, we get repeated readings of the same location with different
            // accuracy which seems to count as a different reading - maybe it's just a very slightly
            // different reading or maybe altitude, accuracy etc has changed
            if(previousLat != position.coords.latitude || previousLong != position.coords.longitude) {
                // if(position.coords.speed > maxSpeed)
                //     maxSpeed = position.coords.speed;
                // else if(position.coords.speed < minSpeed)
                //     minSpeed = position.coords.speed;
                    
                // if(position.coords.altitude > maxAltitude)
                //     maxAltitude = position.coords.altitude;
                // else if(position.coords.altitude < minAltitude)
                //     minAltitude = position.coords.altitude;

                previousLat = position.coords.latitude;
                previousLong = position.coords.longitude;

                var textarea = $("#geo-output");
                textarea.html("Latitude=" + position.coords.latitude + ", "
                    + "Longitude=" + position.coords.longitude + "\n" + textarea.html());

                console.log("Latitude=" + position.coords.latitude + "\n"
                    + "Longitude=" + position.coords.longitude + "\n"
                    + "Accuracy=" + Math.round(position.coords.accuracy, 1) + "m\n"
                    + "Speed=" + position.coords.speed + "m/s\n"
                    + "Altitude=" + position.coords.altitude + "\n"
                    + "Altitude Accuracy=" + Math.round(position.coords.altitudeAccuracy,1) + "\n"
                    + "Heading=" + position.coords.heading + "\n"
                    + "Time=" + currentDatetime + "\n\n"
                );
            }
        }
        else {
            console.log("Accuracy not sufficient (" + Math.round(position.coords.accuracy, 1)
             + "m vs " + minAccuracy + "m) - last reading taken at: " + currentDatetime);
        }
    }

    /**
     * Called whenever navigator.geolocation.watchPosition() generates an error.
     * @param  {Object} error A description of the error that occurred
     * @return {void}
     */
    function geoError(error) {
        switch(error.code) {
            case error.TIMEOUT:
                $("#geo-output").html("timeout\n" + $("#geo-output").html());
                console.log("geoError: Timeout!");
            break;
        };
    }

    /**
     * Setup a watchPosition to continually monitor the geolocation service.
     * @return {void}
     */
    function geoGetPos() {
        wpid = navigator.geolocation.watchPosition(geoSuccess, geoError, {
            enableHighAccuracy: enableHighAccuracy,
            maximumAge: maximumAge,
            timeout: timeout
        });
    }

    /**
     * Starts the gelocation service.
     * @return {void}
     */
    function geoInit() {
        if(wpid == null) {
            geoGetPos();
        }
    }

    return {
        init: function() {
            google.maps.event.addDomListener(window, 'load', mapInit);

            // Redraw the Google map when we navigate to the page
            $(document).on("pageshow", "#googleMapsPage", function() {
                google.maps.event.trigger(map, 'resize');
                map.setCenter(initialPos);
            });
        }
    };
})(jQuery, google).init();

// function loadScript() {
//     var script = document.createElement('script');
//     script.type = 'text/javascript';
//     script.src = 'https://maps.googleapis.com/maps/api/js?v=3.exp&sensor=true&callback=mapInit';
//     document.body.appendChild(script);
// }
//window.onload = loadScript;