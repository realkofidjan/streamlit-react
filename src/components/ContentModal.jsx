
import ContentModalInner from './ContentModalInner';

function ContentModal({ content, onClose, show }) {
    // If not showing, render nothing. This prevents hooks from running conditionally.
    if (!show || !content) return null;

    return <ContentModalInner content={content} onClose={onClose} show={show} />;
}

export default ContentModal;
