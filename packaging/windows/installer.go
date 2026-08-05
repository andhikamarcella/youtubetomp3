package main

import (
	"archive/zip"
	"bytes"
	_ "embed"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const version = "1.7.0"

//go:embed payload.zip
var payload []byte

func main() {
	if err := install(); err != nil {
		fmt.Fprintln(os.Stderr, "YTConv installer:", err)
		os.Exit(1)
	}
	fmt.Printf("YTConv %s installed successfully.\n", version)
	fmt.Println("Open a new CMD or PowerShell window and run: ytconv --version")
}

func install() error {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		return errors.New("LOCALAPPDATA is unavailable")
	}
	target := filepath.Join(localAppData, "Programs", "YTConv")
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return fmt.Errorf("create application directory: %w", err)
	}
	stage, err := os.MkdirTemp(filepath.Dir(target), "YTConv-install-")
	if err != nil {
		return fmt.Errorf("create staging directory: %w", err)
	}
	defer func() {
		if stage != "" {
			_ = os.RemoveAll(stage)
		}
	}()

	if err := extractPayload(stage); err != nil {
		return err
	}
	versionBytes, err := os.ReadFile(filepath.Join(stage, "VERSION"))
	if err != nil {
		return fmt.Errorf("read payload version: %w", err)
	}
	if strings.TrimSpace(string(versionBytes)) != version {
		return fmt.Errorf("payload version is %q, expected %s", strings.TrimSpace(string(versionBytes)), version)
	}

	if err := os.RemoveAll(target); err != nil {
		return fmt.Errorf("remove previous installation: %w", err)
	}
	if err := os.Rename(stage, target); err != nil {
		return fmt.Errorf("activate installation: %w", err)
	}
	stage = ""

	windowsApps := filepath.Join(localAppData, "Microsoft", "WindowsApps")
	if err := os.MkdirAll(windowsApps, 0o755); err != nil {
		return fmt.Errorf("create launcher directory: %w", err)
	}
	shim := "@echo off\r\nsetlocal EnableExtensions\r\n\"%LOCALAPPDATA%\\Programs\\YTConv\\ytconv.cmd\" %*\r\nexit /b %ERRORLEVEL%\r\n"
	if err := os.WriteFile(filepath.Join(windowsApps, "ytconv.cmd"), []byte(shim), 0o644); err != nil {
		return fmt.Errorf("write WindowsApps launcher: %w", err)
	}

	command := exec.Command("cmd.exe", "/d", "/c", filepath.Join(target, "ytconv.cmd"), "--version")
	output, err := command.CombinedOutput()
	if err != nil {
		return fmt.Errorf("verify installed CLI: %w: %s", err, strings.TrimSpace(string(output)))
	}
	if strings.TrimSpace(string(output)) != version {
		return fmt.Errorf("installed CLI reported %q, expected %s", strings.TrimSpace(string(output)), version)
	}
	return nil
}

func extractPayload(destination string) error {
	reader, err := zip.NewReader(bytes.NewReader(payload), int64(len(payload)))
	if err != nil {
		return fmt.Errorf("open embedded payload: %w", err)
	}
	cleanRoot, err := filepath.Abs(destination)
	if err != nil {
		return err
	}
	for _, entry := range reader.File {
		name := filepath.Clean(filepath.FromSlash(entry.Name))
		if name == "." || filepath.IsAbs(name) || strings.HasPrefix(name, ".."+string(os.PathSeparator)) || name == ".." {
			return fmt.Errorf("unsafe payload path: %q", entry.Name)
		}
		target := filepath.Join(cleanRoot, name)
		absolute, err := filepath.Abs(target)
		if err != nil {
			return err
		}
		if absolute != cleanRoot && !strings.HasPrefix(absolute, cleanRoot+string(os.PathSeparator)) {
			return fmt.Errorf("payload path escapes target: %q", entry.Name)
		}
		if entry.FileInfo().IsDir() {
			if err := os.MkdirAll(absolute, 0o755); err != nil {
				return err
			}
			continue
		}
		if entry.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("symbolic links are forbidden in payload: %q", entry.Name)
		}
		if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
			return err
		}
		source, err := entry.Open()
		if err != nil {
			return err
		}
		destinationFile, err := os.OpenFile(absolute, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
		if err != nil {
			_ = source.Close()
			return err
		}
		_, copyErr := io.Copy(destinationFile, source)
		closeErr := destinationFile.Close()
		sourceErr := source.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
		if sourceErr != nil {
			return sourceErr
		}
	}
	return nil
}
