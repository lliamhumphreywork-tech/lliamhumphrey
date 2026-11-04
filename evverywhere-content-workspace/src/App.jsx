import { useState } from 'react';
import TopNav from './components/TopNav.jsx';
import GenerateSection from './sections/GenerateSection.jsx';
import LibrarySection from './sections/LibrarySection.jsx';
import BriefsSection from './sections/BriefsSection.jsx';
import { useLocalStorage } from './hooks/useLocalStorage.js';

export default function App() {
  const [section, setSection] = useState('generate');
  const [library, setLibrary] = useLocalStorage('ev_library', []);
  const [briefs, setBriefs] = useLocalStorage('ev_briefs', []);
  const [viewCarousel, setViewCarousel] = useState(null);

  function handleViewCarousel(carousel) {
    setViewCarousel(carousel);
    setSection('generate');
  }

  function handleLoadBrief(brief) {
    setSection('generate');
    // Pass brief via state — GenerateSection will pick it up
    setViewCarousel({ _isBrief: true, brief });
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg text-cream font-sans">
      <TopNav section={section} setSection={setSection} />

      <div className="flex-1 flex overflow-hidden">
        {section === 'generate' && (
          <GenerateSection
            key={viewCarousel?.id || 'generate'}
            library={library}
            setLibrary={setLibrary}
            briefs={briefs}
            setBriefs={setBriefs}
            initialCarousel={viewCarousel?._isBrief ? null : viewCarousel}
            initialBrief={viewCarousel?._isBrief ? viewCarousel.brief : null}
          />
        )}
        {section === 'library' && (
          <LibrarySection
            library={library}
            setLibrary={setLibrary}
            onViewCarousel={handleViewCarousel}
          />
        )}
        {section === 'briefs' && (
          <BriefsSection
            briefs={briefs}
            setBriefs={setBriefs}
            onLoadBrief={handleLoadBrief}
          />
        )}
      </div>
    </div>
  );
}
