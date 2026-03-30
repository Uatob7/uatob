// write the main app component here, and export it as default
import Drivers from '@/App/Drivers';
export default function Home({ uid }) {
    return <Drivers uid={uid} />;
}
