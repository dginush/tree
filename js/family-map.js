const FamilyMap = (() => {
    let map = null;
    let markers = [];
    let geocodeCache = {};
    let isRendering = false;
  
    // Load geocode cache from localStorage
    try {
      var cached = localStorage.getItem("familyTree_geocodeCache");
      if (cached) geocodeCache = JSON.parse(cached);
    } catch (e) {}
  
    function saveCache() {
      try {
        localStorage.setItem(
          "familyTree_geocodeCache",
          JSON.stringify(geocodeCache)
        );
      } catch (e) {}
    }
  
    function initMap() {
      if (map) return;
  
      var container = document.getElementById("familyMap");
      if (!container) return;
  
      map = L.map("familyMap", {
        center: [31.7683, 35.2137], // ירושלים - ברירת מחדל
        zoom: 8,
        zoomControl: true,
        attributionControl: true,
      });
  
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
  
      // Fix map rendering in hidden tabs
      setTimeout(function () {
        map.invalidateSize();
      }, 200);
    }
  
    function createPinIcon(member) {
      var gender = member.gender || "male";
      var pinColor = gender === "male" ? "#1976d2" : "#e91e63";
      var borderColor = gender === "male" ? "#0d47a1" : "#880e4f";
  
      if (member.status === "deceased") {
        pinColor = "#78909c";
        borderColor = "#455a64";
      }
  
      var photoHTML = "";
      if (member.photo) {
        photoHTML =
          '<img src="' +
          member.photo +
          '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
      } else {
        var initials = App.getInitials(member.firstName, member.lastName);
        photoHTML =
          '<div style="width:100%;height:100%;border-radius:50%;background:' +
          pinColor +
          ";display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;font-family:'Heebo',sans-serif;\">" +
          initials +
          "</div>";
      }
  
      var html =
        '<div class="map-pin-wrapper">' +
        '<div class="map-pin" style="--pin-color:' +
        pinColor +
        ";--pin-border:" +
        borderColor +
        ';">' +
        '<div class="map-pin-photo">' +
        photoHTML +
        "</div>" +
        "</div>" +
        '<div class="map-pin-shadow"></div>' +
        "</div>";
  
      return L.divIcon({
        html: html,
        className: "map-pin-icon",
        iconSize: [48, 62],
        iconAnchor: [24, 62],
        popupAnchor: [0, -58],
      });
    }
  
    function createPopup(member) {
      var age = App.calculateAge(member.birthDate, member.deathDate);
      var bg = member.gender === "male" ? "#1976d2" : "#e91e63";
  
      var h = '<div class="map-popup">';
      h += '<div class="map-popup-header">';
      if (member.photo) {
        h +=
          '<img class="map-popup-avatar" src="' +
          member.photo +
          '" alt="">';
      } else {
        h +=
          '<div class="map-popup-avatar" style="background:' +
          bg +
          ";display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;font-family:'Heebo',sans-serif;\">" +
          App.getInitials(member.firstName, member.lastName) +
          "</div>";
      }
      h += "<div>";
      h +=
        '<div class="map-popup-name">' +
        member.firstName +
        " " +
        member.lastName +
        "</div>";
      if (age !== null)
        h += '<div class="map-popup-age">גיל ' + age + "</div>";
      h += "</div></div>";
      h +=
        '<div class="map-popup-address">📍 ' + member.address + "</div>";
  
      if (member.phone) {
        h +=
          '<div class="map-popup-detail">📞 ' + member.phone + "</div>";
      }
  
      h +=
        '<button class="btn btn-primary btn-sm" style="width:100%;margin-top:8px;font-size:0.8em;" ' +
        "onclick=\"App.viewMember('" +
        member.id +
        "')\">" +
        "👁️ צפייה בפרטים</button>";
      h += "</div>";
      return h;
    }
  
    async function geocodeAddress(address) {
      if (!address || address.trim().length < 3) return null;
  
      var key = address.trim().toLowerCase();
      if (geocodeCache[key]) return geocodeCache[key];
  
      try {
        var url =
          "https://nominatim.openstreetmap.org/search?format=json&q=" +
          encodeURIComponent(address) +
          "&limit=1&accept-language=he";
  
        var response = await fetch(url, {
          headers: {
            "User-Agent": "FamilyTreeApp/1.0",
          },
        });
  
        if (!response.ok) return null;
  
        var data = await response.json();
        if (data && data.length > 0) {
          var result = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            display: data[0].display_name,
          };
          geocodeCache[key] = result;
          saveCache();
          return result;
        }
        return null;
      } catch (err) {
        console.error("Geocode error for:", address, err);
        return null;
      }
    }
  
    function clearMarkers() {
      markers.forEach(function (m) {
        map.removeLayer(m);
      });
      markers = [];
    }
  
    async function render() {
      if (isRendering) return;
      isRendering = true;
  
      initMap();
  
      // Force map to recalculate size
      setTimeout(function () {
        if (map) map.invalidateSize();
      }, 100);
  
      clearMarkers();
  
      var members = App.getMembers();
      var withAddress = members.filter(function (m) {
        return m.address && m.address.trim().length >= 3;
      });
  
      var countEl = document.getElementById("mapMemberCount");
      var noMembersEl = document.getElementById("mapNoMembers");
      var mapContainer = document.getElementById("familyMapContainer");
  
      if (withAddress.length === 0) {
        if (countEl) countEl.textContent = "";
        if (noMembersEl) noMembersEl.style.display = "";
        if (mapContainer) mapContainer.style.display = "none";
        isRendering = false;
        return;
      }
  
      if (noMembersEl) noMembersEl.style.display = "none";
      if (mapContainer) mapContainer.style.display = "";
  
      var geocoded = 0;
      var bounds = [];
  
      for (var i = 0; i < withAddress.length; i++) {
        var member = withAddress[i];
  
        // Rate limit - Nominatim allows 1 request per second
        if (i > 0 && !geocodeCache[member.address.trim().toLowerCase()]) {
          await new Promise(function (resolve) {
            setTimeout(resolve, 1100);
          });
        }
  
        var coords = await geocodeAddress(member.address);
        if (coords) {
          var icon = createPinIcon(member);
          var marker = L.marker([coords.lat, coords.lng], { icon: icon })
            .addTo(map)
            .bindPopup(createPopup(member), {
              maxWidth: 250,
              className: "map-custom-popup",
            });
  
          markers.push(marker);
          bounds.push([coords.lat, coords.lng]);
          geocoded++;
        }
      }
  
      if (countEl) {
        countEl.textContent =
          geocoded + " מתוך " + withAddress.length + " כתובות על המפה";
      }
  
      if (bounds.length > 0) {
        if (bounds.length === 1) {
          map.setView(bounds[0], 14);
        } else {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        }
      }
  
      isRendering = false;
    }
  
    function fitAll() {
      if (!map || markers.length === 0) return;
      var bounds = markers.map(function (m) {
        var ll = m.getLatLng();
        return [ll.lat, ll.lng];
      });
      if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      } else {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }
  
    function destroy() {
      if (map) {
        map.remove();
        map = null;
      }
      markers = [];
    }
  
    return {
      render: render,
      fitAll: fitAll,
      destroy: destroy,
      initMap: initMap,
    };
  })();