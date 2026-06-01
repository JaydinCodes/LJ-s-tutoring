import {useEffect, useMemo, useRef, useState} from "react";

function easeOutCubic(t){ return 1 - Math.pow(1-t, 3)};

function usePrefersReducedMotion(){
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");

        const update = () => setReduced(query.matches);
        update();

        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    })
}