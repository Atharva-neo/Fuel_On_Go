// Swipe + slide navigation for the two bottom-tab navigators (customer and pump owner).
//
//  * Slide animation: the tab navigator's own sceneStyleInterpolator. `current.progress` is -1 for a
//    scene sitting to the left of the focused one, 0 for the focused one and +1 for one to the right, so
//    moving to a later tab slides in from the right and an earlier tab from the left. Only the scenes
//    move; the tab bar stays put. Scenes stay mounted, so scroll position, filters and form state survive.
//  * Swipe: every scene is wrapped (via `screenLayout`) in one PanGestureHandler that only activates
//    after a clear horizontal move and fails as soon as the move is vertical, so lists keep scrolling.
//    Routes with a pannable map (Home) only listen on thin strips at the screen edges, so
//    panning the map never changes tab. Scan QR is NOT one of them: the camera preview is passive
//    (scanning needs no touches), so the whole screen swipes; buttons still get plain taps.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { PanGestureHandler, State, type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { isSwipe, targetIndex } from './swipeMath';

export const EDGE_WIDTH = 28;
const LOCK_MS = 320; // ignore further swipes while a transition is running

function slideInterpolator({ current }: { current: { progress: Animated.AnimatedInterpolation<number> } }) {
  const width = Dimensions.get('window').width;
  return {
    sceneStyle: {
      transform: [{ translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-width, 0, width] }) }],
    },
  };
}

const slideSpec = { animation: 'timing' as const, config: { duration: 240, easing: Easing.out(Easing.cubic) } };

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduce(!!v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** Spread into <Tab.Navigator screenOptions>. */
export function slideScreenOptions(reduceMotion: boolean) {
  return reduceMotion
    ? { animation: 'none' as const }
    : { sceneStyleInterpolator: slideInterpolator, transitionSpec: slideSpec };
}

interface SwipeProps {
  navigation: any;
  route: { name: string };
  edgeOnly: string[];
  children: React.ReactNode;
}

function SwipeScene({ navigation, route, edgeOnly, children }: SwipeProps) {
  const lockedUntil = useRef(0);

  const onEnd = useCallback(
    (e: PanGestureHandlerStateChangeEvent) => {
      if (e.nativeEvent.state !== State.END) return;
      const { translationX: dx, translationY: dy, velocityX: vx } = e.nativeEvent;
      if (!isSwipe(dx, dy, vx)) return;
      const now = Date.now();
      if (now < lockedUntil.current) return;
      const state = navigation.getState();
      const to = targetIndex(state.index, state.routes.length, dx);
      if (to === null) return;
      lockedUntil.current = now + LOCK_MS;
      navigation.navigate(state.routes[to].name);
    },
    [navigation]
  );

  const handler = (child: React.ReactNode, style?: object, key?: string) => (
    <PanGestureHandler key={key} activeOffsetX={[-24, 24]} failOffsetY={[-14, 14]} onHandlerStateChange={onEnd}>
      <View style={style ?? styles.fill} collapsable={false}>
        {child}
      </View>
    </PanGestureHandler>
  );

  if (edgeOnly.includes(route.name)) {
    return (
      <View style={styles.fill}>
        {children}
        {handler(null, [styles.edge, { left: 0 }] as any, 'l')}
        {handler(null, [styles.edge, { right: 0 }] as any, 'r')}
      </View>
    );
  }
  return handler(children);
}

/** `screenLayout` for a Tab.Navigator. `edgeOnly` lists routes holding a pannable map. */
export function swipeLayout(edgeOnly: string[] = []) {
  return ({ navigation, route, children }: { navigation: any; route: { name: string }; children: React.ReactElement }) => (
    <SwipeScene navigation={navigation} route={route} edgeOnly={edgeOnly}>
      {children}
    </SwipeScene>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  edge: { position: 'absolute', top: 0, bottom: 0, width: EDGE_WIDTH },
});
