import React, { Component, Suspense, lazy } from 'react';

const HeroScene3D = lazy(() => import('./HeroScene3D'));

class WebGLErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function StaticFoodFallback({ height = 340 }) {
  return (
    <div
      style={{
        height,
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
      }}
    >
      <div className="centerpiece-3d" style={{ width: 220, height: 220 }}>
        <div className="centerpiece-orbit-ring" />
        <img
          src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop"
          alt="Signature Gourmet Burger"
          style={{ width: 175, height: 175, objectFit: 'cover', borderRadius: '50%' }}
        />
      </div>
    </div>
  );
}

export default function HeroCanvasWrapper({ height = 340 }) {
  const fallback = <StaticFoodFallback height={height} />;
  return (
    <WebGLErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <HeroScene3D height={height} />
      </Suspense>
    </WebGLErrorBoundary>
  );
}
