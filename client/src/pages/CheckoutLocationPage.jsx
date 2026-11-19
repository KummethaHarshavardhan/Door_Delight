import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crosshair, MapPin, Search } from 'lucide-react';
import { addressAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }
    const existing = document.getElementById('dd-google-maps-sdk');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google?.maps));
      return;
    }
    const script = document.createElement('script');
    script.id = 'dd-google-maps-sdk';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google?.maps);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function CheckoutLocationPage() {
  const { cart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [coords, setCoords] = useState(null); // { lat, lng }
  const [searchQuery, setSearchQuery] = useState('');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [mapsReady, setMapsReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    label: 'Home',
    street: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
  });

  useEffect(() => {
    if (!cart.items || cart.items.length === 0) {
      navigate('/customer/cart', { replace: true });
      return;
    }
    addressAPI
      .list()
      .then((res) => setSavedAddresses(res.data.addresses || []))
      .catch(() => {});
  }, [cart.items, navigate]);

  const reverseGeocode = useCallback(async (lat, lng) => {
    if (window.google?.maps?.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const comp = results[0].address_components || [];
          const getComp = (type) => comp.find((c) => c.types.includes(type))?.long_name || '';
          setForm((prev) => ({
            ...prev,
            street: results[0].formatted_address || prev.street,
            city: getComp('locality') || getComp('administrative_area_level_2') || prev.city,
            state: getComp('administrative_area_level_1') || prev.state,
            pincode: getComp('postal_code') || prev.pincode,
          }));
        }
      });
      return;
    }

    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      if (resp.ok) {
        const data = await resp.json();
        const addr = data.address || {};
        setForm((prev) => ({
          ...prev,
          street: data.display_name || prev.street,
          city: addr.city || addr.town || addr.village || prev.city,
          state: addr.state || prev.state,
          pincode: addr.postcode || prev.pincode,
        }));
      }
    } catch {
      // Ignore reverse-geocode failure
    }
  }, []);

  const updatePinPosition = useCallback(
    (lat, lng) => {
      setCoords({ lat, lng });
      if (mapInstanceRef.current && markerRef.current) {
        const pos = { lat, lng };
        markerRef.current.setPosition(pos);
        mapInstanceRef.current.panTo(pos);
      }
      reverseGeocode(lat, lng);
    },
    [reverseGeocode]
  );

  // Initialize Google Map when VITE_GOOGLE_MAPS_API_KEY is configured
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || !mapContainerRef.current) return;
    let active = true;

    loadGoogleMapsScript(GOOGLE_MAPS_KEY)
      .then((gmaps) => {
        if (!active || !gmaps || !mapContainerRef.current) return;
        const center = coords || { lat: 12.9716, lng: 77.5946 };
        const map = new gmaps.Map(mapContainerRef.current, {
          center,
          zoom: 15,
          streetViewControl: false,
        });
        const marker = new gmaps.Marker({
          position: center,
          map,
          draggable: true,
        });
        marker.addListener('dragend', () => {
          const pos = marker.getPosition();
          if (pos) updatePinPosition(pos.lat(), pos.lng());
        });
        map.addListener('click', (e) => {
          if (e.latLng) updatePinPosition(e.latLng.lat(), e.latLng.lng());
        });
        mapInstanceRef.current = map;
        markerRef.current = marker;
        setMapsReady(true);
      })
      .catch(() => {
        setMapsReady(false);
      });

    return () => {
      active = false;
    };
  }, [coords, updatePinPosition]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('Browser geolocation is not supported', 'error');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        updatePinPosition(pos.coords.latitude, pos.coords.longitude);
        showToast('Current location pinned! Adjust the pin if needed.', 'success');
      },
      (err) => {
        setLocating(false);
        showToast(err.message || 'Location permission denied. Search or select manually.', 'info');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSearchAddress = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (window.google?.maps?.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: searchQuery.trim() }, (results, status) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location;
          updatePinPosition(loc.lat(), loc.lng());
        } else {
          showToast('Address not found on Google Maps', 'error');
        }
      });
      return;
    }

    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(searchQuery.trim())}`
      );
      const data = await resp.json();
      if (data?.[0]) {
        updatePinPosition(parseFloat(data[0].lat), parseFloat(data[0].lon));
      } else {
        showToast('Address not found. Please refine your search.', 'error');
      }
    } catch {
      showToast('Search failed. Please enter address manually.', 'error');
    }
  };

  const handleConfirmLocation = async (e) => {
    e.preventDefault();
    if (!form.street.trim() || !form.city.trim() || !form.pincode.trim()) {
      showToast('Please enter street, city, and pincode', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await addressAPI.create({
        ...form,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        is_default: true,
      });
      const savedAddress = res.data.address;
      sessionStorage.setItem('dd_checkout_address', JSON.stringify(savedAddress));
      navigate('/customer/checkout/payment', { state: { address: savedAddress } });
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not save delivery location', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-enter" style={{ maxWidth: 920, margin: '0 auto' }}>
      <button type="button" className="btn btn-secondary btn-sm" style={{ marginBottom: 14 }} onClick={() => navigate('/customer/cart')}>
        <ArrowLeft size={15} /> Back to Cart
      </button>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>
        <div className="card card-glass">
          <div className="card-body">
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 12 }}>Select Delivery Location</h1>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={locating}
                onClick={handleUseCurrentLocation}
              >
                <Crosshair size={15} /> {locating ? 'Locating...' : 'Use My Current Location'}
              </button>
            </div>

            <form onSubmit={handleSearchAddress} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                className="input"
                placeholder="Search street, landmark, area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary btn-sm">
                <Search size={15} />
              </button>
            </form>

            {GOOGLE_MAPS_KEY ? (
              <div
                ref={mapContainerRef}
                style={{ width: '100%', height: 270, borderRadius: 14, background: 'var(--surface-alt)' }}
              />
            ) : (
              <div style={{ padding: 14, borderRadius: 14, background: 'var(--surface-alt)', fontSize: '0.86rem' }}>
                <p style={{ marginBottom: 10 }}>
                  <strong>Google Maps API Key Notice:</strong> Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>.env</code> to enable the interactive draggable Google Map. You can still use <strong>Use My Current Location</strong> or search an address above.
                </p>
                {coords && (
                  <iframe
                    title="Pinned Location Preview"
                    width="100%"
                    height="190"
                    style={{ border: 0, borderRadius: 10 }}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.008},${coords.lat - 0.008},${coords.lng + 0.008},${coords.lat + 0.008}&layer=mapnik&marker=${coords.lat},${coords.lng}`}
                  />
                )}
              </div>
            )}

            {coords && (
              <div style={{ marginTop: 10, fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                <MapPin size={14} /> Pinned Coordinates: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                {mapsReady && ' (Drag marker to refine)'}
              </div>
            )}

            {savedAddresses.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: 6 }}>Or Pick a Saved Address:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {savedAddresses.slice(0, 3).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                      onClick={() => {
                        sessionStorage.setItem('dd_checkout_address', JSON.stringify(a));
                        navigate('/customer/checkout/payment', { state: { address: a } });
                      }}
                    >
                      {a.label}: {a.street}, {a.city} - {a.pincode}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card card-glass">
          <div className="card-body">
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 14 }}>Confirm Delivery Address</h2>
            <form onSubmit={handleConfirmLocation}>
              <div className="form-group">
                <label className="form-label">Address Label</label>
                <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Exact Street / House / Flat</label>
                <textarea className="textarea" rows={2} value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Landmark (Optional)</label>
                <input className="input" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Pincode</label>
                  <input className="input" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 9876543210" />
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={saving}>
                {saving ? 'Saving Location...' : 'Confirm Delivery Location'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
