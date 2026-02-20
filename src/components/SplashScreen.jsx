import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./SplashScreen.css";

const SplashScreen = ({ onComplete }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Determine how long to show the splash screen
        const splashTimer = setTimeout(() => {
            setIsVisible(false);
            if (onComplete) setTimeout(onComplete, 500); // Trigger complete after fade out
        }, 2000);

        return () => clearTimeout(splashTimer);
    }, [onComplete]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="splash-screen-container"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                >
                    <motion.img
                        src="/logo.png"
                        alt="App Logo"
                        className="splash-logo"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SplashScreen;
