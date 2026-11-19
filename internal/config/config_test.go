package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaultDataDirUsesUserConfigurationDirectory(t *testing.T) {
	t.Parallel()

	userConfigDir, err := os.UserConfigDir()
	require.NoError(t, err)

	assert.Equal(t, filepath.Join(userConfigDir, "projectflow", "data"), DefaultDataDir())
}

func TestConfigAddress(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		host string
		port string
		want string
	}{
		{
			name: "formats an IPv4 loopback address",
			host: "127.0.0.1",
			port: "16191",
			want: "127.0.0.1:16191",
		},
		{
			name: "formats an IPv6 loopback address",
			host: "::1",
			port: "16191",
			want: "[::1]:16191",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			cfg := &Config{Host: tt.host, Port: tt.port}
			assert.Equal(t, tt.want, cfg.GetAddress())
		})
	}
}
