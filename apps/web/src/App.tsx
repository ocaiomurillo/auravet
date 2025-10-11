import { Route, Routes } from 'react-router-dom';

import MainLayout from './layouts/MainLayout';
import AnimalsPage from './pages/AnimalsPage';
import HomePage from './pages/HomePage';
import NewServicePage from './pages/NewServicePage';
import OwnersPage from './pages/OwnersPage';
import ServicesPage from './pages/ServicesPage';

const App = () => {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/owners" element={<OwnersPage />} />
        <Route path="/animals" element={<AnimalsPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/new-service" element={<NewServicePage />} />
      </Routes>
    </MainLayout>
  );
};

export default App;
