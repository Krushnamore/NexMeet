import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

export default function JoinMeeting() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const wasKicked = searchParams.get('rejoined') === 'true';

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/meetings/${meetingId}`);
        setMeeting(res.data?.meeting || res.data);
      } catch (err) {
        setError('Meeting not found or has ended.');
      } finally {
        setLoading(false);
      }
    };
    if (meetingId) fetch();
  }, [meetingId]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      await api.post(`/meetings/${meetingId}/join`);
      navigate(`/meeting/${meetingId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join. Please try again.');
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white px-4">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">

        {wasKicked && (
          <div className="mb-4 px-4 py-3 bg-orange-900/40 border border-orange-700 rounded-xl text-orange-300 text-sm">
            You were removed from this meeting. You can rejoin below.
          </div>
        )}

        {error ? (
          <>
            <div className="text-red-400 text-sm mb-6">{error}</div>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm transition-colors"
            >
              Back to Dashboard
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl mx-auto mb-4">
              🎥
            </div>
            <h1 className="text-xl font-bold mb-1">{meeting?.title || 'Meeting'}</h1>
            <p className="text-gray-400 text-sm mb-6">
              {wasKicked ? 'Click below to rejoin' : `Hosted by ${meeting?.hostName || 'Host'}`}
            </p>

            <div className="text-left bg-gray-700 rounded-xl p-3 mb-6 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Joining as</span>
                <span className="font-medium">{user?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Meeting ID</span>
                <span className="font-mono text-xs text-gray-300">{meetingId}</span>
              </div>
            </div>

            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl font-semibold transition-colors"
            >
              {joining ? 'Joining...' : wasKicked ? 'Rejoin Meeting' : 'Join Meeting'}
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full mt-3 py-2.5 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
